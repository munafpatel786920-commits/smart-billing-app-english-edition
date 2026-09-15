/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { SalesBillingView } from './components/SalesBillingView';
import { PurchaseBillingView } from './components/PurchaseBillingView';
import { InventoryView } from './components/InventoryView';
import { PartiesView } from './components/PartiesView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SuperAdminView } from './components/SuperAdminView';
import { ExpensesView } from './components/ExpensesView';

import { 
  Menu, 
  X, 
  LayoutDashboard, 
  Receipt, 
  ShoppingBag, 
  Boxes, 
  Users2, 
  BarChart3, 
  Settings, 
  LogOut, 
  Bell, 
  Building,
  UserCheck,
  Sun,
  Moon,
  ShieldCheck,
  Database,
  Wallet
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type ViewType = 'DASHBOARD' | 'SALES_BILLING' | 'PURCHASE_BILLING' | 'INVENTORY' | 'PARTIES' | 'REPORTS' | 'SETTINGS' | 'EXPENSES' | 'SUPER_ADMIN';

export default function App() {
  const { 
    currentUser, 
    userRole, 
    userProfile,
    activeCompany, 
    notifications, 
    logout, 
    theme, 
    toggleTheme,
    updateUserProfile,
    updateCompanyProfile,
    isDemoMode,
    t 
  } = useApp();

  const isSuperAdmin = userProfile?.isSuperAdmin || currentUser?.email === 'patelmunaf90@gmail.com';

  const [currentView, setCurrentView] = useState<ViewType>('DASHBOARD');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      setCurrentView('SUPER_ADMIN');
    } else {
      setCurrentView('DASHBOARD');
    }
  }, [isSuperAdmin]);

  // If user is not authenticated, render AuthView
  if (!currentUser) {
    return <AuthView />;
  }

  let navItems = [
    { id: 'DASHBOARD' as ViewType, label: t('dashboard'), icon: LayoutDashboard },
    { id: 'SALES_BILLING' as ViewType, label: t('salesBilling'), icon: Receipt },
    { id: 'PURCHASE_BILLING' as ViewType, label: t('purchaseBilling'), icon: ShoppingBag },
    { id: 'INVENTORY' as ViewType, label: t('inventory'), icon: Boxes },
    { id: 'EXPENSES' as ViewType, label: t('expenses'), icon: Wallet },
    { id: 'PARTIES' as ViewType, label: t('parties'), icon: Users2 },
    { id: 'REPORTS' as ViewType, label: t('reports'), icon: BarChart3 },
    { id: 'SETTINGS' as ViewType, label: t('settings'), icon: Settings },
  ];

  if (isSuperAdmin) {
    navItems.push({ id: 'SUPER_ADMIN' as ViewType, label: 'Super Admin', icon: ShieldCheck });
  }

  const handleNavClick = (viewId: ViewType) => {
    setCurrentView(viewId);
    setMobileMenuOpen(false);
  };

  if (currentView === 'SUPER_ADMIN') {
    return (
      <div className={`min-h-screen font-sans flex flex-col text-gray-900 bg-gray-50/50 dark:bg-zinc-950 dark:text-zinc-100 ${theme === 'dark' ? 'dark' : ''}`}>
        <header className="h-14 bg-white dark:bg-zinc-900 border-b border-gray-150 dark:border-zinc-800 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            <h1 className="font-extrabold text-sm uppercase tracking-tight">Super Admin Control Center</h1>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-mono px-2 py-0.5 rounded ml-2 hidden sm:inline">
              patelmunaf90@gmail.com
            </span>
          </div>
          <div className="flex items-center gap-3">
             <button
               onClick={() => setCurrentView('DASHBOARD')}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20 active:scale-95 cursor-pointer"
             >
               <LayoutDashboard className="w-4 h-4" />
               <span>Go to Business App</span>
             </button>
             <button 
                onClick={toggleTheme} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
             >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-600" />}
             </button>
             <div className="h-4 w-[1px] bg-gray-200 dark:bg-zinc-800 mx-1"></div>
             <button 
                onClick={logout} 
                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
             >
                <LogOut className="w-4 h-4" /> 
                <span className="hidden sm:inline">Sign Out</span>
             </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <SuperAdminView onOpenApp={() => setCurrentView('DASHBOARD')} />
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex text-gray-900 bg-gray-50/50 dark:bg-zinc-950 dark:text-zinc-100 ${theme === 'dark' ? 'dark' : ''}`}>
      
      {/* Sidebar: Desktop Frame (hidden on mobile) */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-zinc-900 border-r border-gray-150 dark:border-zinc-800 shrink-0 h-screen sticky top-0">
        
        {/* Sidebar Header Brand */}
        <div className="p-5 border-b border-gray-150 dark:border-zinc-805 flex items-center gap-3">
          <div className="p-1 bg-blue-50 dark:bg-zinc-800 rounded-xl text-blue-600 dark:text-white w-9 h-9 flex items-center justify-center shrink-0 shadow-sm border border-gray-200/50 dark:border-zinc-700/50 overflow-hidden">
            {activeCompany?.logoUrl ? (
              <img 
                src={activeCompany.logoUrl} 
                alt="Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="truncate">
            <h1 className="font-extrabold text-[14px] text-gray-900 dark:text-white truncate flex items-center gap-1.5">
              <span className="truncate">{activeCompany?.name || 'Bharat GST Bil'}</span>
            </h1>
            <span className="text-[10px] text-gray-400 font-mono tracking-wider truncate block">
              GSTIN: {activeCompany?.gstin || 'Not Provided'}
            </span>
          </div>
        </div>

        {/* Navigation Elements */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                id={`sidemenu-item-${item.id.toLowerCase()}`}
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 hover:cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                    : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100/50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Profile Footer panel */}
        <div className="p-4 border-t border-gray-150 dark:border-zinc-805 bg-gray-50/40 dark:bg-zinc-850/15 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/15 rounded-lg text-blue-600">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="truncate text-xs">
              <span className="font-bold text-gray-800 dark:text-zinc-200 block truncate">{currentUser.email}</span>
              <span className="text-[10px] text-gray-450 uppercase font-black tracking-widest">{userRole}</span>
            </div>
          </div>
          
          <button
            id="sidemenu-btn-logout"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-zinc-800 hover:bg-red-50 hover:text-red-600 rounded-xl text-[11px] font-bold text-gray-500 dark:text-zinc-400 hover:cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Utilities */}
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-gray-150 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              id="header-mobile-menu-trigger"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-gray-600 dark:text-zinc-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 lg:hidden hover:cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <h2 id="header-view-title" className="text-md sm:text-lg font-black tracking-tight text-gray-900 dark:text-white">
              {navItems.find(item => item.id === currentView)?.label}
            </h2>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase rounded-lg border border-emerald-200/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Licensed Billing Engine Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            
            {/* Theme Toggle Button */}
            <button
              id="header-theme-toggle-btn"
              onClick={toggleTheme}
              className="p-2 text-gray-650 dark:text-zinc-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 hover:cursor-pointer transition-colors"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-blue-600" />
              )}
            </button>

            {/* Dynamic Real-time Notifications Bell dropdown */}
            <div className="relative">
              <button
                id="header-btn-bell"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-600 dark:text-zinc-300 rounded-lg hover:bg-gray-150 dark:hover:bg-zinc-800 hover:cursor-pointer relative"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-red-550 dark:bg-red-500 text-white font-extrabold text-[8px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2.5 w-72 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-2xl shadow-xl p-4 text-xs z-50 overflow-hidden"
                  >
                    <div className="flex justify-between items-center border-b border-gray-50 pb-2 mb-2 font-bold uppercase text-[10px] tracking-wider text-gray-500">
                      <span>Real-time system updates</span>
                      {notifications.length > 0 && <span className="text-rose-500">{notifications.length} Unresolved</span>}
                    </div>

                    {notifications.length === 0 ? (
                      <p className="text-gray-400 py-4 text-center">No new notifications.</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {notifications.map((notif, idx) => (
                          <div key={idx} className="p-2 rounded-xl bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100/40 dark:border-orange-900/10">
                            <p className="font-semibold text-gray-800 dark:text-zinc-200">{notif.title}</p>
                            <p className="text-gray-500 mt-0.5">{notif.message}</p>
                            <span className="text-[9px] text-gray-400 font-mono mt-1 block">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Financial Year switcher */}
            {activeCompany && (
              <div className="flex items-center gap-1">
                <span className="hidden md:inline text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">FY:</span>
                <select
                  value={activeCompany.financialYear || '2026-2027'}
                  onChange={async (e) => {
                    const newFY = e.target.value;
                    try {
                      await updateCompanyProfile({ financialYear: newFY });
                    } catch (err) {
                      console.error("Failed to update financial year:", err);
                    }
                  }}
                  className="bg-gray-100 dark:bg-zinc-850 hover:bg-gray-200 dark:hover:bg-zinc-800 text-[10px] sm:text-xs font-bold rounded-xl px-2 py-1.5 outline-none text-gray-700 dark:text-zinc-300 transition-all border border-gray-200/50 dark:border-zinc-700 cursor-pointer"
                >
                  {(activeCompany.financialYears || ['2025-2026', '2026-2027', '2027-2028', '2028-2029']).map((fy) => (
                    <option key={fy} value={fy}>{fy}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Super Admin Quick Button */}
            {isSuperAdmin && (
              <button
                onClick={() => setCurrentView('SUPER_ADMIN')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-600/20 active:scale-95 cursor-pointer"
                title="Open Super Admin Control Panel"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Super Admin</span>
              </button>
            )}

            {/* Quick user role badge */}
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/10 rounded-full text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100/40">
              {userRole} Role
            </span>

          </div>

        </header>

        {isSuperAdmin && userProfile?.activeCompanyId !== currentUser.uid && (
          <div className="bg-purple-600 text-white text-[10px] py-1.5 px-6 font-black uppercase tracking-[0.2em] flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3" />
                Impersonation Active: Viewing {activeCompany?.name || 'External Workspace'}
              </span>
              <span className="opacity-50">|</span>
              <span className="opacity-80 italic lowercase tracking-normal font-medium text-[9px]">Data is live and production-sync</span>
            </div>
            <button 
              onClick={() => updateUserProfile({ activeCompanyId: currentUser.uid })}
              className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors cursor-pointer"
            >
              Return to My Workspace
            </button>
          </div>
        )}

        {/* Main interactive sub-app boundaries panel space */}
        <main className="flex-grow p-4 sm:p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
              >
                {currentView === 'DASHBOARD' && <DashboardView />}
                {currentView === 'SALES_BILLING' && <SalesBillingView />}
                {currentView === 'PURCHASE_BILLING' && <PurchaseBillingView />}
                {currentView === 'INVENTORY' && <InventoryView />}
                {currentView === 'EXPENSES' && <ExpensesView />}
                {currentView === 'PARTIES' && <PartiesView />}
                {currentView === 'REPORTS' && <ReportsView />}
                {currentView === 'SETTINGS' && <SettingsView />}
                {currentView === 'SUPER_ADMIN' && isSuperAdmin && <SuperAdminView />}
              </motion.div>
            </AnimatePresence>
        </main>

      </div>

      {/* Slide-out mobile drawer overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            
            {/* Dark background overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/60"
            />

            {/* Left slide-out bar */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute top-0 bottom-0 left-0 w-72 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-150">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-blue-50 dark:bg-zinc-800 flex items-center justify-center border border-gray-150 shrink-0">
                      {activeCompany?.logoUrl ? (
                        <img 
                          src={activeCompany.logoUrl} 
                          alt="Logo" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <span className="font-extrabold text-[14px] truncate">{activeCompany?.name || 'Bharat GST'}</span>
                  </div>
                  <button
                    id="mobile-menu-close"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-gray-500 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        id={`mobmenu-item-${item.id.toLowerCase()}`}
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                          isActive 
                            ? 'bg-blue-600 text-white' 
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-150">
                <p className="text-xs text-gray-400 italic">User: {currentUser.email}</p>
                <button
                  id="mobmenu-btn-logout"
                  onClick={logout}
                  className="w-full py-2.5 border border-gray-200 text-red-500 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 hover:cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>

            </motion.aside>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
