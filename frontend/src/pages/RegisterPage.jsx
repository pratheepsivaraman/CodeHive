import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Code2, Hexagon } from 'lucide-react';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await register(username, email, password);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative overflow-hidden">
        {/* Mobile Background Effects */}
        <div className="lg:hidden absolute top-0 left-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px]"></div>

        <div className="w-full max-w-md animate-fade-in relative z-10">
          <div className="mb-10 text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-8">
              <img src="/logo.png" alt="CodeHive" className="w-32 h-32 object-contain drop-shadow-[0_0_20px_rgba(249,115,22,0.6)]" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
            <p className="text-text-muted">Join CodeHive to start collaborating</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-muted ml-1">Username</label>
              <div className="relative group">
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3.5 bg-surface border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white transition-all peer placeholder-transparent"
                  placeholder="code_master"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <span className="absolute left-4 top-3.5 text-text-muted transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-3.5 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-surface px-1 peer-valid:-top-2.5 peer-valid:text-xs peer-valid:bg-surface">
                  Username
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-muted ml-1">Email Address</label>
              <div className="relative group">
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3.5 bg-surface border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white transition-all peer placeholder-transparent"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span className="absolute left-4 top-3.5 text-text-muted transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-3.5 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-surface px-1 peer-valid:-top-2.5 peer-valid:text-xs peer-valid:bg-surface">
                  Email Address
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-muted ml-1">Password</label>
              <div className="relative group">
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3.5 bg-surface border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white transition-all peer placeholder-transparent"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className="absolute left-4 top-3.5 text-text-muted transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-3.5 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-surface px-1 peer-valid:-top-2.5 peer-valid:text-xs peer-valid:bg-surface">
                  Password
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
            >
              {isSubmitting ? 'Creating Account...' : (
                <>
                  Sign Up
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary-light font-medium hover:underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Brand & Imagery */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-bl from-primary-dark/20 to-background overflow-hidden items-center justify-center">
        {/* Background Gradients */}
        <div className="absolute top-10 right-10 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-orange-600/20 rounded-full blur-[120px] animate-pulse-slow delay-1000"></div>

        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPPHBhdGggZD0iTTAgMmg0MHYySDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PHBhdGggZD0iTTAgMGgydjQwSDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PC9zdmc+')] opacity-20 mask-image-radial-gradient"></div>

        <div className="relative z-10 text-center animate-fade-in">
          <div className="mb-8 flex justify-center">
            <img src="/logo.png" alt="CodeHive" className="w-80 h-80 object-contain drop-shadow-[0_0_30px_rgba(249,115,22,0.7)]" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 tracking-tight leading-tight">
            Start Your <span className="text-transparent bg-clip-text bg-gradient-to-l from-primary-light to-orange-400">Journey.</span>
          </h1>
          <p className="text-xl text-text-muted leading-relaxed">
            Create an account in seconds and instantly join a powerful collaborative development environment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
