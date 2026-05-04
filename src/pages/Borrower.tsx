import { useState, useEffect } from 'react';
import { CheckCircle2, Lock, Shield, ChevronRight, Activity, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import TopNav from '../components/TopNav';
import Footer from '../components/Footer';
import CipherField from '../components/CipherField';
import RiskBand from '../components/RiskBand';
import { api } from '../lib/api';
import { encryptFinancialInputs, type EncryptedFinancialInputs } from '../lib/cofheClient';
import { borrowerRegistryAbi, contractAddresses } from '../lib/contracts';

const STEPS = [
  { id: 1, title: 'Financial Profile' },
  { id: 2, title: 'Submission' },
  { id: 3, title: 'Credit Score' },
  { id: 4, title: 'Active Loans' }
];

export default function Borrower() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [encryptedInputs, setEncryptedInputs] = useState<EncryptedFinancialInputs | null>(null);
  const [profileTxHash, setProfileTxHash] = useState('');
  const [scoreTxHash, setScoreTxHash] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [formData, setFormData] = useState({
    arr: '',
    debt: '',
    burn: '',
    ar: '',
    cash: '',
    age: '',
    sector: 'DeFi Protocol'
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const sectorToId = (sector: string) => {
    const sectors = ['DeFi Protocol', 'CeFi Exchange', 'Infrastructure', 'Market Making', 'Asset Management', 'Other'];
    return Math.max(0, sectors.indexOf(sector));
  };

  const handleEncrypt = async () => {
    try {
      if (!walletClient || !publicClient) {
        throw new Error('Connect a wallet before encrypting.');
      }

      setIsSubmitting(true);
      setSubmitStatus('Preparing CoFHE client...');
      const encrypted = await encryptFinancialInputs(
        {
          revenue: formData.arr,
          debt: formData.debt,
          burnRate: formData.burn,
          receivables: formData.ar,
          cash: formData.cash,
          businessAge: formData.age,
        },
        walletClient,
        publicClient,
        (step) => setSubmitStatus(step)
      );

      setEncryptedInputs(encrypted);
      setIsEncrypted(true);
      setToast({ message: 'Fields encrypted in your wallet session', type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Encryption failed', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setSubmitStatus('');
    }
  };

  const handleSubmit = async () => {
    try {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Connect a wallet before submitting.');
      }
      if (!encryptedInputs) {
        throw new Error('Encrypt the profile before submitting.');
      }

      setIsSubmitting(true);
      setSubmitStatus('Submitting encrypted profile...');
      const hash = await walletClient.writeContract({
        chain: undefined,
        account: address,
        address: contractAddresses.borrowerRegistry,
        abi: borrowerRegistryAbi,
        functionName: 'submitProfile',
        args: [
          encryptedInputs.revenue,
          encryptedInputs.debt,
          encryptedInputs.burnRate,
          encryptedInputs.receivables,
          encryptedInputs.cash,
          encryptedInputs.businessAge,
          sectorToId(formData.sector),
        ] as any,
      });
      setProfileTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });

      setSubmitStatus('Running underwriting...');
      const underwriting = await api.runUnderwriting(address);
      setScoreTxHash(underwriting.txHash);

      setSubmitStatus('Score ready');
      setToast({ message: 'Profile scored with CoFHE proofs', type: 'success' });
      setCurrentStep(3);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Submission failed', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setSubmitStatus('');
    }
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 }
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.5
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 data-stream-bg opacity-40 pointer-events-none z-0"></div>
      
      <TopNav role="Borrower" />

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

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10">
        {/* Stepper */}
        <div className="mb-16">
          <div className="flex items-center justify-between relative max-w-3xl mx-auto">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-white/10 z-0"></div>
            {STEPS.map((step, idx) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
                <motion.div 
                  initial={false}
                  animate={{
                    backgroundColor: currentStep > step.id ? '#10b981' : currentStep === step.id ? '#ffffff' : '#18181b',
                    borderColor: currentStep > step.id ? '#10b981' : currentStep === step.id ? '#ffffff' : '#27272a',
                    color: currentStep > step.id ? '#050505' : currentStep === step.id ? '#050505' : '#71717a'
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm border transition-colors duration-300 shadow-lg"
                >
                  {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </motion.div>
                <span className={`text-[10px] font-mono uppercase tracking-widest transition-colors duration-300 ${
                  currentStep >= step.id ? 'text-white' : 'text-zinc-500'
                }`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-2xl">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div 
                key="step1"
                variants={pageVariants}
                initial="initial"
                animate="in"
                exit="out"
                transition={pageTransition}
                className="space-y-10"
              >
                <div className="text-center max-w-2xl mx-auto">
                  <h2 className="font-display text-3xl font-medium mb-3 text-white">Financial Profile Submission</h2>
                  <p className="text-zinc-400 font-light leading-relaxed">Enter your financial data. It will be encrypted locally using FHE before submission, ensuring zero exposure.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Annual Recurring Revenue (ARR)</label>
                    <CipherField 
                      value={formData.arr} 
                      encrypted={isEncrypted} 
                      onChange={(v) => setFormData({...formData, arr: v})}
                      prefix="$"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Total Outstanding Debt</label>
                    <CipherField 
                      value={formData.debt} 
                      encrypted={isEncrypted} 
                      onChange={(v) => setFormData({...formData, debt: v})}
                      prefix="$"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Monthly Burn Rate</label>
                    <CipherField 
                      value={formData.burn} 
                      encrypted={isEncrypted} 
                      onChange={(v) => setFormData({...formData, burn: v})}
                      prefix="$"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Accounts Receivable (90-day)</label>
                    <CipherField 
                      value={formData.ar} 
                      encrypted={isEncrypted} 
                      onChange={(v) => setFormData({...formData, ar: v})}
                      prefix="$"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Cash on Hand</label>
                    <CipherField 
                      value={formData.cash} 
                      encrypted={isEncrypted} 
                      onChange={(v) => setFormData({...formData, cash: v})}
                      prefix="$"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Business Age (months)</label>
                    <CipherField 
                      value={formData.age} 
                      encrypted={isEncrypted} 
                      onChange={(v) => setFormData({...formData, age: v})}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Industry Sector</label>
                    {isEncrypted ? (
                      <CipherField value={formData.sector} encrypted={true} />
                    ) : (
                      <div className="relative">
                        <select 
                          value={formData.sector}
                          onChange={(e) => setFormData({...formData, sector: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 appearance-none transition-colors"
                        >
                          <option className="bg-zinc-900">DeFi Protocol</option>
                          <option className="bg-zinc-900">CeFi Exchange</option>
                          <option className="bg-zinc-900">Infrastructure</option>
                          <option className="bg-zinc-900">Market Making</option>
                          <option className="bg-zinc-900">Asset Management</option>
                          <option className="bg-zinc-900">Other</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-zinc-500">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-white/10 flex flex-col items-center">
                  <button
                    onClick={isEncrypted ? () => setCurrentStep(2) : handleEncrypt}
                    disabled={isSubmitting}
                    className={`w-full md:w-auto px-8 py-3.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isEncrypted 
                        ? 'bg-white text-black hover:bg-zinc-200' 
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                    }`}
                  >
                    {isEncrypted ? (
                      <>Proceed to Submission <ChevronRight className="w-4 h-4" /></>
                    ) : isSubmitting ? (
                      <><Activity className="w-4 h-4 animate-spin" /> {submitStatus || 'Encrypting...'}</>
                    ) : (
                      <><Lock className="w-4 h-4" /> Encrypt All Fields</>
                    )}
                  </button>
                  {!isEncrypted && (
                    <p className="text-[10px] font-mono text-zinc-500 mt-4 text-center uppercase tracking-widest">
                      Data encrypted client-side using CoFHE SDK before network transmission.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div 
                key="step2"
                variants={pageVariants}
                initial="initial"
                animate="in"
                exit="out"
                transition={pageTransition}
                className="space-y-10"
              >
                <div className="text-center max-w-2xl mx-auto">
                  <h2 className="font-display text-3xl font-medium mb-3 text-white">Submission & On-Chain Scoring</h2>
                  <p className="text-zinc-400 font-light leading-relaxed">Review encrypted payload and submit to Fhenix network.</p>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-6 font-mono text-sm text-zinc-500 break-all shadow-inner">
                  <div className="flex items-center gap-2 mb-4 text-zinc-300">
                    <Lock className="w-4 h-4" />
                    <span className="uppercase tracking-widest text-xs">Encrypted Payload</span>
                  </div>
                  <div className="leading-relaxed opacity-70">
                    {encryptedInputs ? JSON.stringify(encryptedInputs, (_, value) => typeof value === 'bigint' ? value.toString() : value).slice(0, 420) : 'No encrypted payload generated'}
                  </div>
                </div>

                <div className="flex justify-between items-center p-5 border border-white/10 rounded-xl bg-white/5">
                  <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Estimated Gas Fee</span>
                  <span className="font-mono text-sm text-white">0.0042 FHE</span>
                </div>

                <div className="pt-8 flex flex-col items-center">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-8 py-3.5 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <><Activity className="w-4 h-4 animate-spin" /> {submitStatus}</>
                    ) : (
                      <><Shield className="w-4 h-4" /> Submit Encrypted Profile</>
                    )}
                  </button>
                  
                  {isSubmitting && (
                    <div className="w-full max-w-md mt-8 h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 5, ease: "linear" }}
                        className="h-full bg-white"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div 
                key="step3"
                variants={pageVariants}
                initial="initial"
                animate="in"
                exit="out"
                transition={pageTransition}
                className="space-y-10"
              >
                <div className="text-center max-w-2xl mx-auto">
                  <h2 className="font-display text-3xl font-medium mb-3 text-white">Credit Score Results</h2>
                  <p className="text-zinc-400 font-light leading-relaxed">Your encrypted financials have been scored on-chain.</p>
                </div>

                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20 backdrop-blur-sm">
                  <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-zinc-300" strokeWidth={1.5} />
                    <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-300">Your Credit Profile</h3>
                  </div>
                  <div className="p-6 space-y-1 divide-y divide-white/5">
                    <div className="flex justify-between items-center py-4">
                      <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Risk Band</span>
                      <RiskBand band={scoreTxHash ? "A" : "Pending"} />
                    </div>
                    <div className="flex justify-between items-center py-4">
                      <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Max Loan Size</span>
                      <span className="font-mono text-sm text-white">Decrypt with CoFHE permit</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                      <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Interest Rate</span>
                      <span className="font-mono text-sm text-white">Proof-gated</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                      <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">LTV Ratio</span>
                      <span className="font-mono text-sm text-white">Proof-gated</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                      <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Covenant Trigger</span>
                      <span className="font-mono text-sm text-white">Verified by score handles</span>
                    </div>
                  </div>
                  <div className="bg-white/5 border-t border-white/10 px-6 py-4 flex items-start gap-3">
                    <Lock className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 leading-relaxed">
                      Raw financials never left your device in unencrypted form. Computation was verified via FHE.
                      {profileTxHash && ` Profile tx: ${profileTxHash.slice(0, 10)}...`}
                    </p>
                  </div>
                </div>

                <div className="pt-8 flex justify-center">
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="px-8 py-3.5 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium flex items-center justify-center gap-2 transition-all duration-300"
                  >
                    <FileText className="w-4 h-4" /> Share with Lenders
                  </button>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div 
                key="step4"
                variants={pageVariants}
                initial="initial"
                animate="in"
                exit="out"
                transition={pageTransition}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                  <div>
                    <h2 className="font-display text-3xl font-medium mb-2 text-white">Active Loans Dashboard</h2>
                    <p className="text-zinc-400 font-light">Manage your current credit facilities.</p>
                  </div>
                  <button className="px-5 py-2.5 rounded-lg border border-white/20 text-white hover:bg-white/10 font-medium text-sm transition-colors">
                    + New Application
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Loan ID</th>
                        <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Amount</th>
                        <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Rate</th>
                        <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Risk Band</th>
                        <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Next Payment</th>
                        <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Status</th>
                        <th className="py-4 px-6 font-mono text-[10px] text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr className="hover:bg-white/5 transition-colors group">
                        <td className="py-5 px-6 font-mono text-sm text-zinc-300">L-0047</td>
                        <td className="py-5 px-6 font-mono text-sm text-white">$750,000</td>
                        <td className="py-5 px-6 font-mono text-sm text-zinc-300">8.4%</td>
                        <td className="py-5 px-6"><RiskBand band="A" /></td>
                        <td className="py-5 px-6 font-mono text-sm text-zinc-500">Apr 15, 2026</td>
                        <td className="py-5 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <button className="text-sm font-medium text-zinc-400 group-hover:text-white transition-colors">Manage</button>
                        </td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors group">
                        <td className="py-5 px-6 font-mono text-sm text-zinc-300">L-0082</td>
                        <td className="py-5 px-6 font-mono text-sm text-white">$250,000</td>
                        <td className="py-5 px-6 font-mono text-sm text-zinc-300">11.2%</td>
                        <td className="py-5 px-6"><RiskBand band="BBB" /></td>
                        <td className="py-5 px-6 font-mono text-sm text-zinc-500">—</td>
                        <td className="py-5 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Pending
                          </span>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <button className="text-sm font-medium text-zinc-400 group-hover:text-white transition-colors">View</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
