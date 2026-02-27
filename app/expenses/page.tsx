"use client";

import { useState, useEffect } from "react";
import DataTable from "react-data-table-component";
import { createTheme } from "react-data-table-component";
import { db } from "@/src/lib/firebase";
import { collection, addDoc, getDocs, setDoc, doc } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
//import { deleteDoc } from "firebase/firestore";
import { deleteDoc, updateDoc } from "firebase/firestore";
createTheme("darkProfessional", {
  text: {
    primary: "#E2E8F0",
    secondary: "#94A3B8",
  },
  background: {
  default: "#0F172A",
},
context: {
  background: "#0F172A",
  text: "#E2E8F0",
},
  divider: {
    default: "#334155",
  },
});
createTheme("lightProfessional", {
  text: {
    primary: "#111827",       
    secondary: "#6B7280",     
  },
  background: {
    default: "#FFFFFF",       
  },
  context: {
    background: "#F9FAFB",
    text: "#111827",
  },
  divider: {
    default: "#E5E7EB",      
  },
});

type CarryForward = Record<string, number>;

export default function ExpensePage() {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("expenses");
  const [carryForward, setCarryForward] = useState<CarryForward>({
  Founder1: 0,
  Founder2: 0,
  Founder3: 0
});


  const founders = ["Founder1", "Founder2", "Founder3"];
  const companyName = "Company";
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPaidBy, setEditPaidBy] = useState("");
  const [darkMode, setDarkMode] = useState(true); // default dark
const [fromAccount, setFromAccount] = useState("");
const [toAccount, setToAccount] = useState("");
const [transferAmount, setTransferAmount] = useState("");

const accounts = ["Founder1", "Founder2", "Founder3", "Company"];

const getCurrentMonthKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const [selectedDate, setSelectedDate] = useState(new Date());

const getMonthKeyFromDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const currentMonth = getMonthKeyFromDate(selectedDate);

  /* ---------------- LOAD DATA ---------------- */

  const loadExpenses = async () => {
    const snapshot = await getDocs(collection(db, "months", currentMonth, "expenses"));
    setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const loadSettlements = async () => {
    const snapshot = await getDocs(collection(db, "months", currentMonth, "settlements"));
    setSettlements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

const getPreviousMonthKey = () => {
  const prev = new Date(selectedDate);
  prev.setMonth(prev.getMonth() - 1);
  return getMonthKeyFromDate(prev);
};

const loadCarryForward = async () => {
  const prevMonth = getPreviousMonthKey();
  const snapshot = await getDocs(collection(db, "carryForward", prevMonth, "balances"));

  const map: CarryForward = { Founder1: 0, Founder2: 0, Founder3: 0 };

  snapshot.docs.forEach(doc => {
    map[doc.id] = doc.data().amount;
  });

  setCarryForward(map);
};

useEffect(() => {
  loadExpenses();
  loadSettlements();
  loadCarryForward();
}, [currentMonth]);

const startEdit = (exp: any) => {
  setEditingId(exp.id);
  setEditTitle(exp.title);
  setEditAmount(exp.amount.toString());
  setEditPaidBy(exp.paidBy);
};

const cancelEdit = () => {
  setEditingId(null);
};

const saveEdit = async (id: string) => {
  if (!editTitle || !editAmount || !editPaidBy) {
    alert("Fill all fields");
    return;
  }

  await updateDoc(
    doc(db, "months", currentMonth, "expenses", id),
    {
      title: editTitle,
      amount: Number(editAmount),
      paidBy: editPaidBy
    }
  );

  setEditingId(null);
  loadExpenses();
};


const deleteExpense = async (id: string) => {
  const confirmDelete = confirm("Delete this expense?");
  if (!confirmDelete) return;

  await deleteDoc(doc(db, "months", currentMonth, "expenses", id));

  loadExpenses();
};


  /* ---------------- ADD EXPENSE ---------------- */

  const addExpense = async () => {
    if (!title || !amount || !paidBy) return alert("Enter all fields");

    await addDoc(collection(db, "months", currentMonth, "expenses"), {
      title,
      amount: Number(amount),
      paidBy,
      createdAt: serverTimestamp()
    });

    setTitle("");
    setAmount("");
    setPaidBy("");

    loadExpenses();
  };

  /* ---------------- CALCULATIONS ---------------- */

// Total paid by founders
const founderPayments = expenses
  .filter(e => founders.includes(e.paidBy))
  .reduce((sum, e) => sum + e.amount, 0);

// TOTAL COMPANY EXPENSE (ALL EXPENSES)
const totalCompanyExpense = expenses.reduce(
  (sum, e) => sum + e.amount,
  0
);

// EACH FOUNDER SHARE
const eachShare =
  founders.length > 0
    ? Number((totalCompanyExpense / founders.length).toFixed(2))
    : 0;
// Track how much each founder paid
const paidMap: any = { Founder1: 0, Founder2: 0, Founder3: 0 };

expenses.forEach(exp => {
  if (founders.includes(exp.paidBy)) {
    paidMap[exp.paidBy] += exp.amount;
  }
});

// Track settlements
const settlementMap: any = { Founder1: 0, Founder2: 0, Founder3: 0 };

settlements.forEach(s => {

  // Founder paid money TO company
  if (s.to === "Company" && settlementMap[s.from] !== undefined) {
    settlementMap[s.from] += s.amount;
  }

  // Company paid money TO founder
  if (s.from === "Company" && settlementMap[s.to] !== undefined) {
    settlementMap[s.to] -= s.amount;
  }

});

// Calculate balances
const balances = founders.map(name => {
  const paid = paidMap[name] || 0;
  const settled = settlementMap[name] || 0;
  const previousDue = carryForward[name] || 0;

  // Net before settlement
  const net = paid - eachShare;

  // Apply settlements & previous dues
  const finalBalance = parseFloat(
    (net + settled + previousDue).toFixed(2)
  );

  return {
    name,
    paid,
    companyOwes: finalBalance > 0 ? finalBalance : 0,
    founderOwes: finalBalance < 0 ? Math.abs(finalBalance) : 0,
    finalBalance
  };
});

  // record transfer (Paid By → Paid To)
const recordTransfer = async () => {
  if (!fromAccount || !toAccount || !transferAmount) {
    alert("Fill all fields");
    return;
  }

  if (fromAccount === toAccount) {
    alert("Cannot transfer to the same account.");
    return;
  }

  if (Number(transferAmount) <= 0) {
    alert("Amount must be greater than zero.");
    return;
  }

  await addDoc(
    collection(db, "months", currentMonth, "settlements"),
    {
      from: fromAccount,
      to: toAccount,
      amount: Number(transferAmount),
      settledAt: serverTimestamp()
    }
  );

  setFromAccount("");
  setToAccount("");
  setTransferAmount("");

  loadSettlements();
};

  /* ---------------- RESET MONTH ---------------- */

const resetMonth = async () => {
  const today = new Date();
const dueDate = getDueDate();

if (today < dueDate) {
  alert("Cannot close cycle before due date.");
  return;
}
const confirmReset = confirm(
    "Close billing cycle? Unpaid balances will carry forward."
  );
  if (!confirmReset) return;

  for (const b of balances) {
    if (Math.abs(b.finalBalance) > 1) {
  await setDoc(
    doc(db, "carryForward", currentMonth, "balances", b.name),
    {
      amount: b.finalBalance
    }
  );
}
  }

  alert("Billing cycle closed. New month started.");


  loadExpenses();
  loadSettlements();
};

const getDueDate = () => {
  const now = selectedDate;
  return new Date(now.getFullYear(), now.getMonth() + 1, 15);
};

const getCycleEndDate = () => {
  const now = selectedDate;
  return new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day
};

const isOverdue = () => {
  const today = new Date();
  const due = getDueDate();

  const hasPending = balances.some(b => Math.abs(b.finalBalance) > 1);

  return today > due && hasPending;
};


// DATE FORMAT
const formatDate = (date: Date) => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`; // DD/MM/YYYY
};


const ITEMS_PER_PAGE = 8;

const [expensePage, setExpensePage] = useState(1);
const [settlementPage, setSettlementPage] = useState(1);

const filteredExpenses = expenses.filter(exp =>
  exp.title.toLowerCase().includes(search.toLowerCase())
);

const paginatedExpenses = filteredExpenses.slice(
  (expensePage - 1) * ITEMS_PER_PAGE,
  expensePage * ITEMS_PER_PAGE
);

const paginatedSettlements = settlements.slice(
  (settlementPage - 1) * ITEMS_PER_PAGE,
  settlementPage * ITEMS_PER_PAGE
);

useEffect(() => {
  setExpensePage(1);
  setSettlementPage(1);
  setSearch("");
}, [currentMonth]);

const expenseColumns = [
  {
    name: "Title",
    selector: (row: any) => row.title,
    sortable: true
  },
  {
  name: "Amount",
  selector: (row: any) => row.amount,
  sortable: true,
  cell: (row: any) => `₹${row.amount}`
},
  {
    name: "Paid By",
    selector: (row: any) => row.paidBy,
    sortable: true
  },
  {
  name: "Date",
  selector: (row: any) => row.createdAt?.seconds || 0,
  sortable: true,
  cell: (row: any) =>
    row.createdAt?.toDate().toLocaleDateString() || ""
}
];

const settlementColumns = [
  {
    name: "Paid By",
    selector: (row: any) => row.from || row.founder || "Company",
    sortable: true
  },
  {
    name: "Paid To",
    selector: (row: any) => row.to || "Company",
    sortable: true
  },
  {
  name: "Amount",
  selector: (row: any) => row.amount,
  sortable: true,
  cell: (row: any) => `₹${row.amount}`
},
  {
    name: "Type",
    selector: (row: any) =>
      row.from ? "Transfer" : "Mark Paid",
    sortable: true
  },
  {
  name: "Date",
  selector: (row: any) => row.settledAt?.seconds || 0,
  sortable: true,
  cell: (row: any) =>
    row.settledAt?.toDate().toLocaleDateString() || ""
}
];

const tableStyles = {
  rows: {
    style: {
      minHeight: "60px",
      fontSize: "14px",
    },
  },
  headCells: {
    style: {
      fontSize: "13px",
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
    },
  },
  cells: {
    style: {
      paddingTop: "14px",
      paddingBottom: "14px",
    },
  },
};

  /* ---------------- UI ---------------- */

return (
  <div
  className={`min-h-screen ${
    darkMode
? "bg-neutral-900 text-neutral-100"
  : "bg-gray-50 text-gray-900"
  }`}
>
  <div className="max-w-7xl mx-auto px-6 py-8">

    {/* HEADER */}
<div className="flex justify-between items-center mb-10">
  <h1 className="text-4xl font-semibold tracking-tight">
    Expense Dashboard
  </h1>

  <button
    onClick={() => setDarkMode(!darkMode)}
    className={`px-5 py-2.5 rounded-xl font-medium shadow-sm transition ${
      darkMode
        ? "bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
        : "bg-white hover:bg-gray-100 shadow-sm"
    }`}
  >
    {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
  </button>
</div>

    {/* MONTH NAVIGATION */}
    <div className="flex justify-center items-center gap-6 mb-10">
      <button
        className={`px-5 py-2.5 rounded-xl font-medium transition ${
  darkMode
    ? "bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
    : "bg-white hover:bg-gray-100 shadow-sm"
}`}
        onClick={() =>
          setSelectedDate(
            new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
          )
        }
      >
        ◀ Prev Month
      </button>

      <span className="text-lg font-semibold">{currentMonth}</span>

      <button
        className={`px-5 py-2.5 rounded-xl font-medium transition ${
  darkMode
    ? "bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
    : "bg-white hover:bg-gray-100 shadow-sm"
}`}
        onClick={() =>
          setSelectedDate(
            new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
          )
        }
      >
        Next Month ▶
      </button>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">

     {/* LEFT — ADD EXPENSE */}
<div
  className={`rounded-2xl p-6 shadow-sm space-y-4 h-fit xl:col-span-1 ${
    darkMode
  ? "bg-neutral-800 border border-neutral-700 shadow-sm"
  : "bg-white shadow-sm"
  }`}
>
        <h2 className="text-xl font-semibold tracking-tight">
  Add Expense
</h2>

        <input
          className={`w-full p-3 rounded-xl ${
  darkMode
    ? "bg-neutral-700 border border-neutral-600 focus:ring-1 focus:ring-neutral-500 outline-none"
    : "bg-white text-black shadow-sm focus:ring-1 focus:ring-neutral-400 outline-none"
}`}
          placeholder="Expense Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          className={`w-full p-3 rounded-xl ${
  darkMode
    ? "bg-neutral-700 border border-neutral-600 focus:ring-1 focus:ring-neutral-500 outline-none"
    : "bg-white text-black shadow-sm focus:ring-1 focus:ring-neutral-400 outline-none"
}`}
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <select
          className={`w-full p-3 rounded-xl ${
  darkMode
    ? "bg-neutral-700 border border-neutral-600 focus:ring-1 focus:ring-neutral-500 outline-none"
    : "bg-white text-black shadow-sm focus:ring-1 focus:ring-neutral-400 outline-none"
}`}
          value={paidBy}
          onChange={e => setPaidBy(e.target.value)}
        >
          <option value="">Who Paid?</option>
          <option value="Founder1">Founder1</option>
          <option value="Founder2">Founder2</option>
          <option value="Founder3">Founder3</option>
          <option value="Company">Company</option>
        </select>

        <button
  onClick={addExpense}
  className={`w-full py-3 rounded-xl font-medium transition-all duration-150 active:scale-[0.985] ${
    darkMode
      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
      : "bg-neutral-900 hover:bg-neutral-800 text-white"
  }`}
>
          Add Expense
        </button>
      </div>

      {/* RIGHT PANEL */}
<div
  className={`rounded-2xl p-6 shadow-sm space-y-6 xl:col-span-2 ${
    darkMode
      ? "bg-neutral-800 border border-neutral-700 shadow-sm"
      : "bg-white shadow-sm"
  }`}
>

        {/* KPI GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

  {/* Total Expenses */}
  <div
    className={`p-6 rounded-2xl border shadow-sm transition-all duration-200 ${
  darkMode
    ? "bg-neutral-900 border-neutral-800 hover:-translate-y-0.5 hover:shadow-md"
    : "bg-white border-gray-200 hover:-translate-y-0.5 hover:shadow-md"
}`}
  >
    <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
      Total Expenses
    </p>
    <p className="text-2xl md:text-3xl font-bold tracking-tight">
      ₹{totalCompanyExpense.toLocaleString("en-IN")}
    </p>
  </div>

  {/* Paid by Founders */}
  <div
    className={`p-6 rounded-2xl border shadow-sm transition-all duration-200 ${
  darkMode
    ? "bg-neutral-900 border-neutral-800 hover:-translate-y-0.5 hover:shadow-md"
    : "bg-white border-gray-200 hover:-translate-y-0.5 hover:shadow-md"
}`}
  >
    <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
      Paid by Founders
    </p>
    <p className="text-2xl md:text-3xl font-bold tracking-tight">
      ₹{founderPayments.toLocaleString("en-IN")}
    </p>
  </div>

  {/* Each Share */}
  <div
   className={`p-6 rounded-2xl border shadow-sm transition-all duration-200 ${
  darkMode
    ? "bg-neutral-900 border-neutral-800 hover:-translate-y-0.5 hover:shadow-md"
    : "bg-white border-gray-200 hover:-translate-y-0.5 hover:shadow-md"
}`}
  >
    <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
      Each Share
    </p>
    <p className="text-2xl md:text-3xl font-bold tracking-tight">
      ₹{eachShare.toLocaleString("en-IN")}
    </p>
  </div>

  {/* Total Due */}
  <div
    className={`p-6 rounded-2xl border shadow-sm transition-all duration-200 ${
  darkMode
    ? "bg-neutral-900 border-neutral-800 hover:-translate-y-0.5 hover:shadow-md"
    : "bg-white border-gray-200 hover:-translate-y-0.5 hover:shadow-md"
}`}
  >
    <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
      Total Due
    </p>
    <p className="text-3xl md:text-4xl font-bold tracking-tight text-emerald-400">
      ₹{balances.reduce((sum, b) => sum + b.companyOwes, 0).toFixed(2)}
    </p>
  </div>

</div>

        {/* STATEMENT */}
        <div
  className={`p-6 rounded-2xl space-y-2 shadow-sm ${
    darkMode ? "bg-neutral-800 border border-neutral-700" : "bg-white"
  }`}
>
          <h2 className="text-lg font-semibold">Company Statement</h2>

          <p>Billing Period: {currentMonth}</p>
          <p>
            Previous Due: ₹{
              Object.values(carryForward).reduce((a:any,b:any)=>a+b,0)
            }
          </p>
          <p>Total Expenses This Month: ₹{totalCompanyExpense}</p>
<p>Total Paid by Founders: ₹{founderPayments}</p>

          <p className={`text-3xl font-bold tracking-tight ${
  balances.some(b => b.companyOwes > 0)
  ? "text-emerald-400"
  : balances.some(b => b.founderOwes > 0)
  ? "text-rose-400"
  : "text-slate-400"
}`}>
  TOTAL DUE: ₹{
    balances.reduce((sum, b) => sum + b.companyOwes, 0).toFixed(2)
  }
</p>

          <p>Cycle Ends: {formatDate(getCycleEndDate())}</p>
          <p>Due Date: {formatDate(getDueDate())}</p>

          <p className={`font-medium ${
  isOverdue()
    ? "text-rose-400"
    : balances.some(b => Math.abs(b.finalBalance) > 1)
    ? "text-amber-400"
    : "text-emerald-400"
}`}>
  {isOverdue()
    ? "Overdue"
    : balances.some(b => Math.abs(b.finalBalance) > 1)
    ? "Payment Pending"
    : "Settled"}
</p>
        </div>

        <button
  onClick={resetMonth}
  className={`w-full py-3 rounded-xl font-medium transition-all duration-150 active:scale-[0.985] ${
    darkMode
      ? "bg-rose-600 hover:bg-rose-500 text-white"
      : "bg-neutral-900 hover:bg-neutral-800 text-white"
  }`}
>
          Reset Month
        </button>

        {/* BALANCES */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {balances.map(b => (
              <div
  key={b.name}
  className={`p-6 rounded-2xl shadow-sm flex flex-col gap-4 ${
    darkMode
  ? "bg-neutral-800 border border-neutral-700"
  : "bg-white border border-gray-200"
  }`}
>
                <p className="text-base font-semibold tracking-tight">{b.name}</p>

<div>
  <p className="text-sm">Total Paid: ₹{b.paid.toFixed(2)}</p>

  {b.finalBalance > 0 ? (
  <p className={`${darkMode ? "text-emerald-400" : "text-emerald-600"} font-semibold text-lg`}>
    Company owes ₹{b.finalBalance.toFixed(2)}
  </p>
) : b.finalBalance < 0 ? (
  <p className={`${darkMode ? "text-rose-400" : "text-rose-600"} font-semibold text-lg`}>
    You owe company ₹{Math.abs(b.finalBalance).toFixed(2)}
  </p>
) : (
  <p
  className={`font-semibold text-lg ${
    darkMode ? "text-neutral-500" : "text-neutral-700"
  }`}
>
  Settled
</p>
)}
</div>

<div
  className={`mt-3 pt-3 border-t ${
    darkMode ? "border-slate-700" : "border-gray-200"
  }`}
>
  <p
  className={`text-xs ${
    darkMode ? "text-neutral-400" : "text-neutral-600"
  }`}
>
    Settled: ₹{Math.abs(settlementMap[b.name] || 0).toFixed(2)}
    {settlementMap[b.name] > 0 && " (Paid to Company)"}
    {settlementMap[b.name] < 0 && " (Received)"}
  </p>

  <p
  className={`text-xs ${
    darkMode ? "text-neutral-400" : "text-neutral-600"
  }`}
>
    Previous Due: ₹{(carryForward[b.name] || 0).toFixed(2)}
  </p>
</div>


              </div>
            ))}
        </div>
{/* ===== RECORD TRANSFER (Paid By → Paid To) ===== */}
<div
  className={`p-6 rounded-2xl shadow-sm ${
    darkMode ? "bg-neutral-800 border border-neutral-700" : "bg-white"
  }`}
>
  <h2 className="text-lg font-semibold mb-2">
    Record Settlement (Paid By → Paid To)
  </h2>

  {/* FROM */}
  <select
  value={fromAccount}
  onChange={e => setFromAccount(e.target.value)}
  className={`w-full p-3 rounded-xl mb-3 transition ${
    darkMode
      ? "bg-neutral-700 border border-neutral-600 focus:ring-1 focus:ring-neutral-500 outline-none"
      : "bg-white border border-gray-300 focus:ring-1 focus:ring-gray-400 outline-none"
  }`}
>
    <option value="">Paid By</option>
    {accounts.map(a => (
      <option key={a} value={a}>
        {a}
      </option>
    ))}
  </select>

  {/* TO */}
  <select
  value={toAccount}
  onChange={e => setToAccount(e.target.value)}
  className={`w-full p-3 rounded-xl mb-3 transition ${
    darkMode
      ? "bg-neutral-700 border border-neutral-600 focus:ring-1 focus:ring-neutral-500 outline-none"
      : "bg-white border border-gray-300 focus:ring-1 focus:ring-gray-400 outline-none"
  }`}
>
    <option value="">Paid To</option>
    {accounts
  .filter(a => a !== fromAccount)
  .map(a => (
    <option key={a} value={a}>
      {a}
    </option>
))}
  </select>

  {/* AMOUNT */}
  <input
  placeholder="Amount"
  value={transferAmount}
  onChange={e => setTransferAmount(e.target.value)}
  className={`w-full p-3 rounded-xl mb-4 transition ${
    darkMode
      ? "bg-neutral-700 border border-neutral-600 focus:ring-1 focus:ring-neutral-500 outline-none"
      : "bg-white border border-gray-300 focus:ring-1 focus:ring-gray-400 outline-none"
  }`}
/>

  <button
    onClick={recordTransfer}
    className={`w-full py-3 rounded-xl font-medium transition-all duration-150 active:scale-[0.985] ${
  darkMode
    ? "bg-black hover:bg-neutral-900 text-white"
    : "bg-black hover:bg-neutral-800 text-white"
}`}
  >
    Record Transfer
  </button>
</div>
        {/* TAB BUTTONS */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-5 py-2.5 rounded-xl font-medium transition ${
  activeTab === "expenses"
    ? "bg-indigo-500 text-white shadow-sm"
    : darkMode
    ? "bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
    : "bg-white hover:bg-gray-100 shadow-sm"
}`}
          >
            Expenses
          </button>

          <button
            onClick={() => setActiveTab("settlements")}
            className={`px-5 py-2.5 rounded-xl font-medium transition ${
  activeTab === "settlements"
    ? "bg-indigo-500 text-white shadow-sm"
    : darkMode
    ? "bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
    : "bg-white hover:bg-gray-100 shadow-sm"
}`}
          >
            Settlements
          </button>
        </div>

        {/* ================= EXPENSE TABLE ================= */}
        {activeTab === "expenses" && (
          <>
            <h2 className="text-xl font-semibold mt-4">Expense History</h2>

            <input
            value={search}
              placeholder="Search expenses..."
              className={`w-full p-3 rounded-xl mb-4 ${
  darkMode
    ? "bg-slate-800 border border-slate-700"
    : "bg-white border"
}`}
              onChange={e => setSearch(e.target.value)}
            />

            <DataTable
  theme={darkMode ? "darkProfessional" : "lightProfessional"}
  customStyles={tableStyles}
  columns={expenseColumns}
  data={filteredExpenses}
  pagination
  highlightOnHover
  striped
  responsive
  paginationPerPage={8}
  paginationRowsPerPageOptions={[8, 16, 24]}
/>
          </>
        )}

        {/* ================= SETTLEMENT TABLE ================= */}
        {activeTab === "settlements" && (
          <>


            <h2 className="text-xl font-semibold mb-2">
  Settlement History
</h2>

<DataTable
  theme={darkMode ? "darkProfessional" : "lightProfessional"}
  customStyles={tableStyles}
  columns={settlementColumns}
  data={settlements} 
  pagination
  highlightOnHover
  striped
  responsive
  paginationPerPage={8}
  paginationRowsPerPageOptions={[8, 16, 24]}
/>
          </>
        )}

      </div>
    </div>
  </div>
  </div>
);

}
