import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { socket } from '../services/socket';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const VoiceChat = ({ onlineUsers, onDisconnect }) => {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [peers, setPeers] = useState({}); // { socketId: RTCPeerConnection }
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: MediaStream }
  
  const localStream = useRef(null);
  const peersRef = useRef({}); // Keep a ref for stable access in event listeners
  const audioRefs = useRef({}); // { socketId: HTMLAudioElement }
  
  // Audio Activity Detection
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const isSpeakingRef = useRef(false);

  // ICE Servers configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  useEffect(() => {
    // 1. Get local audio stream
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        localStream.current = stream;
        
        // Notify server that we joined unmuted
        socket.emit('voice-status', { projectId, isMuted: false });
        
        setupAudioActivityDetection(stream);

        // 2. Setup socket listeners for signaling
        socket.on('webrtc-offer', handleReceiveOffer);
        socket.on('webrtc-answer', handleReceiveAnswer);
        socket.on('webrtc-ice-candidate', handleReceiveIceCandidate);
        socket.on('project-users-updated', handleUsersUpdated);

        // Initiate connection with existing users
        const otherUsers = onlineUsers.filter(u => u.socketId !== socket.id);
        otherUsers.forEach(u => initiatePeerConnection(u.socketId));

      })
      .catch(err => {
        console.error("Failed to get local audio", err);
        toast.error("Microphone access denied or unavailable.");
        onDisconnect();
      });

    return () => {
      // Cleanup streams and connections
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(peer => peer.close());
      peersRef.current = {}; // FIX: Clear the ref so Strict Mode remounts can reconnect
      
      socket.emit('voice-status', { projectId, isMuted: true });
      socket.emit('voice-activity', { projectId, isSpeaking: false });
      
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current) audioContextRef.current.close();

      socket.off('webrtc-offer', handleReceiveOffer);
      socket.off('webrtc-answer', handleReceiveAnswer);
      socket.off('webrtc-ice-candidate', handleReceiveIceCandidate);
      socket.off('project-users-updated', handleUsersUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupAudioActivityDetection = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const pcmData = new Float32Array(analyser.fftSize);
      
      const checkActivity = () => {
        if (!analyserRef.current || isMuted) {
           if (isSpeakingRef.current) {
             isSpeakingRef.current = false;
             socket.emit('voice-activity', { projectId, isSpeaking: false });
           }
           rafRef.current = requestAnimationFrame(checkActivity);
           return;
        }

        analyserRef.current.getFloatTimeDomainData(pcmData);
        let sumSquares = 0.0;
        for (let i = 0; i < pcmData.length; i++) {
            sumSquares += pcmData[i] * pcmData[i];
        }
        
        const rms = Math.sqrt(sumSquares / pcmData.length);
        const isSpeaking = rms > 0.01; // Threshold for speaking
        
        if (isSpeaking !== isSpeakingRef.current) {
          isSpeakingRef.current = isSpeaking;
          socket.emit('voice-activity', { projectId, isSpeaking });
        }
        
        rafRef.current = requestAnimationFrame(checkActivity);
      };
      
      checkActivity();
    } catch (e) {
      console.error("Audio activity detection failed setup", e);
    }
  };

  const createPeer = (targetSocketId) => {
    const peer = new RTCPeerConnection(rtcConfig);
    
    // Add local stream tracks to the peer connection
    localStream.current.getTracks().forEach(track => {
      peer.addTrack(track, localStream.current);
    });

    // Handle ICE candidates generated by the local browser
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
          fromSocketId: socket.id
        });
      }
    };

    // Handle incoming remote audio tracks
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      
      setRemoteStreams(prev => ({
        ...prev,
        [targetSocketId]: remoteStream
      }));
    };

    return peer;
  };

  const initiatePeerConnection = async (targetSocketId) => {
    if (peersRef.current[targetSocketId]) return;

    const peer = createPeer(targetSocketId);
    peersRef.current[targetSocketId] = peer;
    
    // Force re-render if needed to show UI indicators
    setPeers({ ...peersRef.current });

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      
      socket.emit('webrtc-offer', {
        targetSocketId,
        offer,
        fromSocketId: socket.id,
        fromUserId: user._id
      });
    } catch (err) {
      console.error("Error creating offer", err);
    }
  };

  const handleReceiveOffer = async ({ offer, fromSocketId }) => {
    const peer = createPeer(fromSocketId);
    peersRef.current[fromSocketId] = peer;
    setPeers({ ...peersRef.current });

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit('webrtc-answer', {
        targetSocketId: fromSocketId,
        answer,
        fromSocketId: socket.id
      });
    } catch (err) {
      console.error("Error handling offer", err);
    }
  };

  const handleReceiveAnswer = async ({ answer, fromSocketId }) => {
    const peer = peersRef.current[fromSocketId];
    if (peer) {
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("Error setting remote description from answer", err);
      }
    }
  };

  const handleReceiveIceCandidate = async ({ candidate, fromSocketId }) => {
    const peer = peersRef.current[fromSocketId];
    if (peer) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate", err);
      }
    }
  };

  const handleUsersUpdated = (updatedUsers) => {
    // If a user left, close their peer connection
    const updatedSocketIds = updatedUsers.map(u => u.socketId);
    
    Object.keys(peersRef.current).forEach(socketId => {
      if (!updatedSocketIds.includes(socketId)) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
        
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[socketId];
          return newStreams;
        });
        
        if (audioRefs.current[socketId]) {
          audioRefs.current[socketId].srcObject = null;
          delete audioRefs.current[socketId];
        }
      }
    });

    setPeers({ ...peersRef.current });
  };

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuteState = !audioTrack.enabled;
        setIsMuted(newMuteState);
        socket.emit('voice-status', { projectId, isMuted: newMuteState });
        
        if (newMuteState && isSpeakingRef.current) {
           isSpeakingRef.current = false;
           socket.emit('voice-activity', { projectId, isSpeaking: false });
        }
      }
    }
  };

  return (
    <div className="flex items-center space-x-2 bg-gray-800 rounded-full px-3 py-1 border border-primary/30 shadow-lg">
      <div className="flex items-center text-xs text-primary font-bold animate-pulse mr-2">
        <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
        Voice Active
      </div>
      
      <button 
        onClick={toggleMute}
        className={`p-1.5 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600'}`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      <button 
        onClick={onDisconnect}
        className="p-1.5 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
        title="Disconnect Voice"
      >
        <PhoneOff size={16} />
      </button>

      {/* Render remote audio elements in DOM */}
      {Object.entries(remoteStreams).map(([id, stream]) => (
        <audio 
          key={id} 
          autoPlay 
          playsInline
          ref={el => { 
            if (el && el.srcObject !== stream) { 
              el.srcObject = stream; 
              el.play().catch(e => console.error("Audio play error", e)); 
            } 
          }} 
        />
      ))}
    </div>
  );
};

export default VoiceChat;
