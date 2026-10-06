import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { socket } from '../services/socket';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const VoiceChat = ({ onlineUsers = [], onDisconnect }) => {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});

  const localStream = useRef(null);
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }
  const audioRefs = useRef({});

  // Audio Activity Detection
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const isSpeakingRef = useRef(false);

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  };

  const setupAudioActivityDetection = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioContext = new AudioCtx();
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
        const isSpeaking = rms > 0.015;

        if (isSpeaking !== isSpeakingRef.current) {
          isSpeakingRef.current = isSpeaking;
          socket.emit('voice-activity', { projectId, isSpeaking });
        }

        rafRef.current = requestAnimationFrame(checkActivity);
      };

      checkActivity();
    } catch (e) {
      console.warn('Audio activity detection unavailable:', e.message);
    }
  };

  const createPeer = useCallback(
    (targetSocketId) => {
      const peer = new RTCPeerConnection(rtcConfig);

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          peer.addTrack(track, localStream.current);
        });
      }

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', {
            targetSocketId,
            candidate: event.candidate,
            fromSocketId: socket.id,
          });
        }
      };

      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStreams((prev) => ({
          ...prev,
          [targetSocketId]: remoteStream,
        }));
      };

      return peer;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId]
  );

  const initiatePeerConnection = useCallback(
    async (targetSocketId) => {
      if (peersRef.current[targetSocketId]) return;

      const peer = createPeer(targetSocketId);
      peersRef.current[targetSocketId] = peer;

      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        socket.emit('webrtc-offer', {
          targetSocketId,
          offer,
          fromSocketId: socket.id,
          fromUserId: user?._id,
        });
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
      }
    },
    [createPeer, user?._id]
  );

  useEffect(() => {
    let isCancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStream.current = stream;

        // Notify server that we joined voice
        socket.emit('join-voice', { projectId });
        setupAudioActivityDetection(stream);

        // Handlers
        const handleReceiveOffer = async ({ offer, fromSocketId }) => {
          let peer = peersRef.current[fromSocketId];
          if (!peer) {
            peer = createPeer(fromSocketId);
            peersRef.current[fromSocketId] = peer;
          }

          try {
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            socket.emit('webrtc-answer', {
              targetSocketId: fromSocketId,
              answer,
              fromSocketId: socket.id,
            });
          } catch (err) {
            console.error('Error handling WebRTC offer:', err);
          }
        };

        const handleReceiveAnswer = async ({ answer, fromSocketId }) => {
          const peer = peersRef.current[fromSocketId];
          if (peer) {
            try {
              await peer.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
              console.error('Error handling WebRTC answer:', err);
            }
          }
        };

        const handleReceiveIceCandidate = async ({ candidate, fromSocketId }) => {
          const peer = peersRef.current[fromSocketId];
          if (peer && candidate) {
            try {
              await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        };

        const handleUserJoinedVoice = ({ socketId }) => {
          if (socketId !== socket.id) {
            initiatePeerConnection(socketId);
          }
        };

        const handleUserLeftVoice = ({ socketId }) => {
          if (peersRef.current[socketId]) {
            peersRef.current[socketId].close();
            delete peersRef.current[socketId];
          }
          setRemoteStreams((prev) => {
            const copy = { ...prev };
            delete copy[socketId];
            return copy;
          });
        };

        socket.on('webrtc-offer', handleReceiveOffer);
        socket.on('webrtc-answer', handleReceiveAnswer);
        socket.on('webrtc-ice-candidate', handleReceiveIceCandidate);
        socket.on('user-joined-voice', handleUserJoinedVoice);
        socket.on('user-left-voice', handleUserLeftVoice);

        // Connect to any other users already in voice
        const currentVoiceUsers = onlineUsers.filter(
          (u) => u.socketId !== socket.id && u.inVoice
        );
        currentVoiceUsers.forEach((u) => initiatePeerConnection(u.socketId));
      })
      .catch((err) => {
        console.error('Microphone access failed:', err);
        toast.error('Microphone access is unavailable or denied by browser.');
        onDisconnect();
      });

    return () => {
      isCancelled = true;
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }
      Object.values(peersRef.current).forEach((peer) => peer.close());
      peersRef.current = {};

      socket.emit('leave-voice', { projectId });

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }

      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('user-joined-voice');
      socket.off('user-left-voice');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="flex items-center space-x-2 bg-surface border border-primary/30 rounded-full px-3 py-1 shadow-lg">
      <div className="flex items-center text-xs text-primary font-bold mr-2">
        <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
        Voice Active
      </div>

      <button
        onClick={toggleMute}
        className={`p-1.5 rounded-full transition-colors ${
          isMuted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-white/10 text-text-muted hover:text-white hover:bg-white/20'
        }`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      <button
        onClick={onDisconnect}
        className="p-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
        title="Leave Voice Chat"
      >
        <PhoneOff size={16} />
      </button>

      {/* Render remote audio elements */}
      {Object.entries(remoteStreams).map(([streamSocketId, stream]) => (
        <audio
          key={streamSocketId}
          autoPlay
          playsInline
          ref={(el) => {
            if (el && el.srcObject !== stream) {
              el.srcObject = stream;
              el.play().catch((e) => console.warn('Audio playback error:', e.message));
            }
            if (el) {
              audioRefs.current[streamSocketId] = el;
            }
          }}
        />
      ))}
    </div>
  );
};

export default VoiceChat;
