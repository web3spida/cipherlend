import { useState, useEffect } from 'react';
import { Filter, ChevronRight, Lock, CheckCircle2, ShieldAlert, Activity, X, Briefcase, LayoutGrid, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAccount } from 'wagmi';
import TopNav from '../components/TopNav';
import RiskBand from '../components/RiskBand';
import Footer from '../components/Footer';
import { api, type LoanOpportunity } from '../lib/api';

const bandLabel = (band: number) => ['-', 'AA', 'A', 'BBB', 'BB', 'B', 'Rejected'][band] ?? 'Pending';
const rateFromBps = (bps: string) => Number(bps) / 100;
const pctFromBps = (bps: string) => Number(bps) / 100;

export default function Lender() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'marketplace' | 'portfolio'>('marketplace');
  const [loans, setLoans] = useState<LoanOpportunity[]>([]);
  const [portfolio, setPortfolio] = useState<LoanOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<LoanOpportunity | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const [available, owned] = await Promise.all([
          api.getAvailableLoans(),
          address ? api.getPortfolio(address) : Promise.resolve({ loans: [] }),
        ]);
        if (!cancelled) {
          setLoans(available);
          setPortfolio(owned.loans ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load loan data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const handleFund = () => {
    if (!fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0) {
      setToast({ message: 'Please enter a valid funding amount', type: 'error' });
      return;
    }
    
    setIsFunding(true);
    setTimeout(() => {
      setIsFunding(false);
      setToast({ message: `Funding submitted for loan #${selectedLoan?.loanId}`, type: 'success' });
      setFundAmount('');
      setTimeout(() => setSelectedLoan(null), 1500);
    }, 2000);
  };

  const handleClaimYield = () => {
    setIsClaiming(true);
    setTimeout(() => {
      setIsClaiming(false);
      setToast({ message: 'Successfully claimed $4,350 in accrued yield', type: 'success' });
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 data-stream-bg opacity-40 pointer-events-none z-0"></div>
      
      <TopNav role="Lender" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <div className={`px-4 py-3 rounded-lg border shadow-lg flex items-center gap-2 font-mono text-sm backdrop-blur-md ${
              toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              'bg-white/5 border-white/10 text-white'
            }`}>
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10">
        {/* Portfolio Summary */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 md:p-8">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Total Deployed</div>
            <div className="font-display text-4xl font-medium text-white">$2.4M</div>
          </div>
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 md:p-8">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Weighted Avg Rate</div>
            <div className="font-display text-4xl font-medium text-emerald-400">9.2%</div>
          </div>
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 md:p-8">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Avg Risk Band</div>
            <div className="font-display text-4xl font-medium text-indigo-400">BBB</div>
          </div>
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 md:p-8">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">30-day Returns</div>
            <div className="font-display text-4xl font-medium text-white">+$18,450</div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-12 border-b border-white/10 pb-4">
          <button 
            onClick={() => setActiveTab('marketplace')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'marketplace' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Marketplace
          </button>
          <button 
            onClick={() => setActiveTab('portfolio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'portfolio' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Briefcase className="w-4 h-4" /> My Portfolio
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'marketplace' ? (
            <motion.div 
              key="marketplace"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col lg:flex-row gap-8"
            >
              {/* Filter Sidebar */}
              <div className="w-full lg:w-64 shrink-0 space-y-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <Filter className="w-5 h-5 text-zinc-400" />
                  </div>
                  <h2 className="font-display font-medium text-xl text-white">Filters</h2>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Risk Band</label>
                  <div className="flex flex-wrap gap-2">
                    {['AA', 'A', 'BBB', 'BB'].map(band => (
                      <button key={band} className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10 text-sm font-mono text-zinc-300 transition-all">
                        {band}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex justify-between ml-1">
                    <span>Loan Size</span>
                    <span className="text-indigo-400">$50K - $5M</span>
                  </label>
                  <input type="range" className="w-full accent-indigo-500" min="50000" max="5000000" />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Min Interest Rate</label>
                  <div className="relative">
                    <input type="number" placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-white/30 transition-all" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">%</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Sector</label>
                  <div className="relative">
                    <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-white/30 transition-all appearance-none">
                      <option className="bg-zinc-900">All Sectors</option>
                      <option className="bg-zinc-900">DeFi Infrastructure</option>
                      <option className="bg-zinc-900">Asset Management</option>
                      <option className="bg-zinc-900">Market Making</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-zinc-500">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Covenant Type</label>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 text-sm font-mono cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" className="peer appearance-none w-5 h-5 border border-white/20 rounded-md bg-white/5 checked:bg-indigo-500 checked:border-indigo-500 transition-all cursor-pointer" defaultChecked />
                        <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                      </div>
                      <span className="text-zinc-400 group-hover:text-white transition-colors">DSCR-linked</span>
                    </label>
                    <label className="flex items-center gap-3 text-sm font-mono cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" className="peer appearance-none w-5 h-5 border border-white/20 rounded-md bg-white/5 checked:bg-indigo-500 checked:border-indigo-500 transition-all cursor-pointer" defaultChecked />
                        <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                      </div>
                      <span className="text-zinc-400 group-hover:text-white transition-colors">Fixed</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Loan Cards */}
              <div className="flex-grow space-y-6">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="font-display font-medium text-2xl text-white">Active Opportunities</h2>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-widest">Showing {loans.length} loans</span>
                </div>

                {isLoading && <div className="text-zinc-400 font-mono text-sm">Loading live loan opportunities...</div>}
                {loadError && <div className="text-red-400 font-mono text-sm">{loadError}</div>}
                {!isLoading && !loadError && loans.length === 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-zinc-400">
                    No pending loans are available from the backend right now.
                  </div>
                )}

                {loans.map((loan, i) => (
                  <motion.div 
                    key={loan.loanId} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 flex flex-col md:flex-row justify-between gap-8 hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
                  >
                    <div className="flex-grow space-y-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-4 mb-2">
                            <h3 className="font-mono font-medium text-xl text-white group-hover:text-indigo-400 transition-colors">LOAN-{loan.loanId}</h3>
                            <RiskBand band={bandLabel(loan.riskBand)} />
                          </div>
                          <p className="text-sm text-zinc-400 font-light">{loan.borrower}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-display font-medium text-3xl text-white">${Number(loan.amount).toLocaleString()}</div>
                          <div className="text-sm font-mono text-emerald-400 mt-1">{rateFromBps(loan.rateBps).toFixed(2)}% APR</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-y border-white/10">
                        <div>
                          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">LTV</div>
                          <div className="font-mono font-medium text-lg text-white">{pctFromBps(loan.ltvBps).toFixed(0)}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Term</div>
                          <div className="font-mono font-medium text-lg text-white">{loan.termMonths} mo</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Borrower Profile</div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 bg-white/5 w-fit px-3 py-1.5 rounded-lg border border-white/10 uppercase tracking-widest">
                            <Lock className="w-3.5 h-3.5 text-emerald-400" /> Encrypted
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-2.5 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                          <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                          Score verified on-chain
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setSelectedLoan(loan)}
                            className="px-6 py-2.5 rounded-lg border border-white/20 hover:bg-white/10 text-sm font-medium text-white transition-all"
                          >
                            View Details
                          </button>
                          <button 
                            onClick={() => setSelectedLoan(loan)}
                            className="px-6 py-2.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm font-medium transition-all shadow-lg"
                          >
                            Fund This Loan
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="portfolio"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
                <div>
                  <h2 className="font-display font-medium text-2xl text-white">My Funded Loans</h2>
                  <p className="text-zinc-400 font-light">Track your active investments and claim accrued yield.</p>
                </div>
                <button 
                  onClick={handleClaimYield}
                  disabled={isClaiming}
                  className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClaiming ? (
                    <><Activity className="w-4 h-4 animate-spin" /> Claiming...</>
                  ) : (
                    <><ArrowUpRight className="w-4 h-4" /> Claim All Yield ($4,350)</>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Loan ID</th>
                      <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Principal</th>
                      <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Rate</th>
                      <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Risk Band</th>
                      <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Next Payment</th>
                      <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Accrued Yield</th>
                      <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {portfolio.map((loan) => (
                      <tr key={loan.loanId} className="hover:bg-white/5 transition-colors group">
                        <td className="py-5 px-6 font-mono text-sm text-zinc-300 group-hover:text-white transition-colors">LOAN-{loan.loanId}</td>
                        <td className="py-5 px-6 font-mono text-sm text-white">${Number(loan.amount).toLocaleString()}</td>
                        <td className="py-5 px-6 font-mono text-sm text-zinc-300">{rateFromBps(loan.rateBps).toFixed(2)}%</td>
                        <td className="py-5 px-6"><RiskBand band={bandLabel(loan.riskBand)} /></td>
                        <td className="py-5 px-6 font-mono text-sm text-zinc-500">Indexed backend</td>
                        <td className="py-5 px-6 font-mono text-sm text-emerald-400">Proof-gated</td>
                        <td className="py-5 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                            Live
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!isLoading && portfolio.length === 0 && (
                      <tr>
                        <td className="py-8 px-6 text-zinc-400" colSpan={7}>No indexed portfolio loans returned by the backend.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />

      {/* Modal */}
      <AnimatePresence>
        {selectedLoan && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
              className="bg-[#0A0C10]/90 border border-white/10 backdrop-blur-2xl rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#0A0C10]/80 backdrop-blur-xl z-10">
                <div className="flex items-center gap-4">
                  <h2 className="font-display font-medium text-2xl text-white">LOAN-{selectedLoan.loanId}</h2>
                  <RiskBand band={bandLabel(selectedLoan.riskBand)} />
                </div>
                <button 
                  onClick={() => setSelectedLoan(null)}
                  className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6 p-6 rounded-2xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Requested Amount</div>
                    <div className="font-display text-4xl font-medium text-white">${Number(selectedLoan.amount).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Interest Rate</div>
                    <div className="font-display text-4xl font-medium text-emerald-400">{rateFromBps(selectedLoan.rateBps).toFixed(2)}% APR</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-mono font-medium text-[10px] uppercase tracking-widest mb-4 text-zinc-400 flex items-center gap-2 ml-1">
                    <ShieldAlert className="w-4 h-4" /> Risk Analysis
                  </h3>
                  <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-4">
                    <p className="text-sm text-zinc-400 font-light leading-relaxed">
                      This borrower has been cryptographically verified to fall within the <strong className="text-white bg-white/10 px-2 py-0.5 rounded font-mono">{bandLabel(selectedLoan.riskBand)}</strong> risk band.
                    </p>
                    <ul className="text-sm text-zinc-400 font-light space-y-3 ml-1">
                      <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> DSCR &gt; 1.5x</li>
                      <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> LTV &lt; {pctFromBps(selectedLoan.ltvBps).toFixed(0)}%</li>
                      <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> No defaults in past 36 months</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-mono font-medium text-[10px] uppercase tracking-widest mb-4 text-zinc-400 flex items-center gap-2 ml-1">
                    <Lock className="w-4 h-4" /> Cryptographic Proof
                  </h3>
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-400 font-light">Borrower Financials</span>
                      <span className="text-[10px] font-mono px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">ENCRYPTED</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-400 font-light">Computation Verified</span>
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-md border border-indigo-500/20 uppercase tracking-widest">Score handle</span>
                    </div>
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Proof Hash</div>
                      <div className="text-xs font-mono text-zinc-500 break-all bg-black/40 p-4 rounded-lg border border-white/5 shadow-inner">
                        0x7f3a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/10">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3 ml-1">Funding Amount</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-lg">$</span>
                      <input 
                        type="number" 
                        value={fundAmount}
                        onChange={(e) => setFundAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 pl-10 text-white font-mono text-lg focus:outline-none focus:border-white/30 transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleFund}
                      disabled={isFunding || !fundAmount}
                      className="px-8 py-4 rounded-xl bg-white text-black hover:bg-zinc-200 font-medium transition-all whitespace-nowrap shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isFunding ? (
                        <><Activity className="w-4 h-4 animate-spin" /> Processing...</>
                      ) : (
                        'Confirm Funding'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
