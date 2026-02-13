import React, { createContext, useContext, useState } from "react";

const AppContext = createContext<any>(null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const role = currentUser?.role || "ADMIN";

  const config = {
    maintenance: { isActive: false },
    isInvestmentEnabled: true
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        systemUsers,
        setSystemUsers,
        transactions,
        setTransactions,
        role,
        config,
        isDemoMode: false
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return context;
};
