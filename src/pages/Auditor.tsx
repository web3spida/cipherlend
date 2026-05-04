import { useState } from 'react';
import { Search, ShieldCheck, Lock, Download, CheckCircle2, FileText, Activity, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAccount } from 'wagmi';
import TopNav from '../components/TopNav';
import RiskBand from '../components/RiskBand';
import Footer from '../components/Footer';
import { api } from '../lib/api';

export default function Auditor() {
  const { address } = useAccount();
  const [loanId, setLoanId] = useState('');
  const [permit, setPermit] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<Awaited<ReturnType<typeof api.verifyAudit>> | null>(null);

  const handleVerify = async () => {
    if (!loanId || !permit || !address) return;
    try {
      setIsVerifying(true);
      setError('');
      const result = await api.verifyAudit({ loanId, permitId: permit, auditorAddress: address });
      setReport(result);
      setVerified(true);
    } catch (err) {
      setReport(null);
      setVerified(false);
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 data-stream-bg opacity-40 pointer-events-none z-0"></div>
      
      <TopNav role="Auditor" />

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="font-display text-4xl md:text-5xl font-medium mb-6 tracking-tight text-white">Permit Verification Panel</h1>
          <p className="text-zinc-400 font-light max-w-2xl mx-auto text-lg leading-relaxed">
            Audit underwriting models and verify loan compliance with zero raw data exposure.
            Enter a loan ID and the corresponding borrower permit to begin.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Input Panel */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="md:col-span-5 space-y-6"
          >
            <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8">
              <h2 className="font-display font-medium text-xl mb-6 flex items-center gap-3 text-white">
                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <Search className="w-5 h-5 text-indigo-400" />
                </div>
                Verification Details
              </h2>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Loan ID or Borrower Address</label>
                  <input 
                    type="text" 
                    value={loanId}
                    onChange={(e) => setLoanId(e.target.value)}
                    placeholder="e.g. LOAN-0047"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-white/30 transition-all placeholder:text-zinc-600"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Permit Hash</label>
                  <textarea 
                    value={permit}
                    onChange={(e) => setPermit(e.target.value)}
                    placeholder="0x..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-all resize-none placeholder:text-zinc-600"
                  />
                </div>

                <button 
                  onClick={handleVerify}
                  disabled={isVerifying || !loanId || !permit || !address}
                  className="w-full py-3.5 rounded-xl bg-white text-black hover:bg-zinc-200 font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-lg"
                >
                  {isVerifying ? (
                    <><Activity className="w-5 h-5 animate-spin" /> Verifying Proof...</>
                  ) : (
                    <><ShieldCheck className="w-5 h-5" /> Verify Compliance</>
                  )}
                </button>
                {error && <div className="text-sm text-red-400 font-mono">{error}</div>}
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6">
              <h3 className="font-display font-medium text-lg mb-4 ml-1 text-white">Recent Verifications</h3>
              <div className="space-y-1">
                {[
                  { id: 'LOAN-0042', time: '2 hours ago', status: 'Valid' },
                  { id: 'LOAN-0038', time: '5 hours ago', status: 'Valid' },
                  { id: 'LOAN-0019', time: '1 day ago', status: 'Invalid Permit' },
                ].map((log, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + (i * 0.1) }}
                    className="flex justify-between items-center p-3 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <div>
                      <div className="font-mono text-sm text-zinc-300 group-hover:text-white transition-colors">{log.id}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{log.time}</div>
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                      log.status === 'Valid' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {log.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Results Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="md:col-span-7"
          >
            <AnimatePresence mode="wait">
              {verified ? (
                <motion.div 
                  key="verified"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                  className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden"
                >
                  <div className="bg-white/5 border-b border-white/10 px-8 py-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                      </div>
                      <h2 className="font-display font-medium text-xl tracking-wider text-white">AUDIT REPORT</h2>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-medium text-white">{loanId}</div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-1 uppercase tracking-widest">Verified: {report ? new Date(report.computedAt * 1000).toLocaleString() : new Date().toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="p-8 space-y-8">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-3 p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
                    >
                      <div className="flex items-center gap-3 text-sm font-mono text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> Underwriting model executed correctly
                      </div>
                      <div className="flex items-center gap-3 text-sm font-mono text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> Score handle exists: {report?.exists ? 'yes' : 'no'}
                      </div>
                      <div className="flex items-center gap-3 text-sm font-mono text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> No manual override detected
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="grid grid-cols-2 gap-y-6 gap-x-8 py-6 border-y border-white/10"
                    >
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Risk Band</div>
                        <div className="font-mono font-medium"><RiskBand band="Proof-gated" /></div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Revenue Bucket</div>
                        <div className="font-mono font-medium text-white">{report?.handles.revenueBucket?.slice(0, 12) ?? 'Handle'} <span className="text-zinc-500 text-[10px] font-normal ml-1">(ciphertext)</span></div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">DSCR Above 1.2x</div>
                        <div className="font-mono font-medium text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Authorized handle returned
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Leverage Ratio</div>
                        <div className="font-mono font-medium text-white">Permit-gated</div>
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Covenant Status</div>
                        <div className="font-mono font-medium text-emerald-400">Requires off-chain decryptForView</div>
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="space-y-5"
                    >
                      <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Raw Financial Data</span>
                        <span className="flex items-center gap-2 text-[10px] font-mono font-medium text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-md border border-indigo-500/20 tracking-widest">
                          <Lock className="w-3.5 h-3.5" /> NOT DISCLOSED
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Computation Proof Hash</div>
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-sm text-zinc-500 break-all flex justify-between items-start gap-4 hover:border-white/20 transition-colors shadow-inner">
                          <span className="leading-relaxed">{report?.proofHash ?? 'No proof hash returned'}</span>
                          <a href="#" className="text-indigo-400 hover:text-white whitespace-nowrap text-xs flex items-center gap-1 transition-colors mt-1">
                            View Explorer <ChevronRight className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="pt-6 flex justify-end"
                    >
                      <button className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 text-white font-medium flex items-center gap-2 transition-all text-sm">
                        <Download className="w-4 h-4" /> Download Audit PDF
                      </button>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[500px] bg-white/5 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center p-12 text-center border-dashed border-2 border-white/10"
                >
                  <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-lg">
                    <FileText className="w-10 h-10 text-zinc-500" />
                  </div>
                  <h3 className="font-display font-medium text-2xl mb-3 text-white">No Report Generated</h3>
                  <p className="text-base text-zinc-400 font-light max-w-md leading-relaxed">
                    Enter a Loan ID and Permit Hash to verify the cryptographic proof of the underwriting computation.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
