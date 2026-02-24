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
    default: "#1E293B",
  },
  divider: {
    default: "#334155",
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
  // NEW transfer states (for Paid To feature)
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

// Total paid by company
const companyPayments = expenses
  .filter(e => e.paidBy === companyName)
  .reduce((sum, e) => sum + e.amount, 0);

// Each founder share of company expenses
const eachShare =
  founders.length > 0
    ? Number((companyPayments / founders.length).toFixed(2))
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
  const paid = paidMap[name];
  const settled = settlementMap[name] || 0;

  // Founder should pay their share of company expenses
  const shouldPay = eachShare;

  // If founder paid personally, company owes them
  const companyOwes = paid;

 const previousDue = carryForward[name] || 0;

const balance = parseFloat(
  (companyOwes - shouldPay + settled + previousDue).toFixed(2)
);

  return { name, paid, balance };
});

  // NEW — record transfer (Paid By → Paid To)
const recordTransfer = async () => {
  if (!fromAccount || !toAccount || !transferAmount) {
    alert("Fill all fields");
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
    if (Math.abs(b.balance) > 1) {
      await setDoc(
  doc(db, "carryForward", currentMonth, "balances", b.name),
  {
    amount: b.balance
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

  const hasPending = balances.some(b => Math.abs(b.balance) > 1);

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

  /* ---------------- UI ---------------- */

return (
  <div
  className={`min-h-screen ${
    darkMode
      ? "bg-slate-950 text-slate-100"
      : "bg-slate-50 text-slate-900"
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
        ? "bg-slate-800 hover:bg-slate-700 border border-slate-700"
        : "bg-white hover:bg-gray-100 border"
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
    ? "bg-slate-800 hover:bg-slate-700 border border-slate-700"
    : "bg-white hover:bg-gray-100 border"
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
    ? "bg-slate-800 hover:bg-slate-700 border border-slate-700"
    : "bg-white hover:bg-gray-100 border"
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
  className={`rounded-2xl p-6 shadow-lg space-y-4 h-fit xl:col-span-1 ${
    darkMode
  ? "bg-slate-900 border border-slate-800 shadow-xl"
  : "bg-white border shadow-sm"
  }`}
>
        <h2 className="text-xl font-semibold tracking-tight">
  Add Expense
</h2>

        <input
          className={`w-full p-3 rounded ${
  darkMode
    ? "bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-white"
    : "bg-gray-100 text-black border"
}`}
          placeholder="Expense Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          className={`w-full p-3 rounded ${
  darkMode
    ? "bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-white"
    : "bg-gray-100 text-black border"
}`}
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <select
          className={`w-full p-3 rounded ${
  darkMode
    ? "bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-white"
    : "bg-gray-100 text-black border"
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
          className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-medium text-white shadow-sm transition"
        >
          Add Expense
        </button>
      </div>

      {/* RIGHT PANEL */}
<div
  className={`rounded-2xl p-6 shadow-lg space-y-6 xl:col-span-2 ${
    darkMode
  ? "bg-slate-900 border border-slate-800 shadow-xl"
  : "bg-white border shadow-sm"
  }`}
>

        {/* KPI GRID */}
        <div className="grid grid-cols-2 gap-6">

          <div
  className={`p-6 rounded-2xl shadow-lg ${
    darkMode ? "bg-slate-800 border border-slate-700" : "bg-gray-100 border"
  }`}
>
            <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Company Expenses</p>
            <p className="text-xl font-bold">
              ₹{companyPayments.toLocaleString("en-IN")}
            </p>
          </div>

          <div
  className={`p-6 rounded-2xl shadow-lg ${
    darkMode ? "bg-slate-800 border border-slate-700" : "bg-gray-100 border"
  }`}
>
           <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Founder Payments</p>
            <p className="text-xl font-bold">
              ₹{founderPayments.toLocaleString("en-IN")}
            </p>
          </div>

          <div
  className={`p-6 rounded-2xl shadow-lg ${
    darkMode ? "bg-slate-800 border border-slate-700" : "bg-gray-100 border"
  }`}
>
            <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Each Share</p>
            <p className="text-xl font-bold">
              ₹{eachShare.toLocaleString("en-IN")}
            </p>
          </div>

          <div
  className={`p-6 rounded-2xl shadow-lg ${
    darkMode ? "bg-slate-800 border border-slate-700" : "bg-gray-100 border"
  }`}
>
            <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Total Due</p>
            <p className="text-xl font-bold">
              ₹{(
                companyPayments -
                founderPayments +
                Object.values(carryForward).reduce((a:any,b:any)=>a+b,0)
              ).toFixed(0)}
            </p>
          </div>
        </div>

        {/* STATEMENT */}
        <div
  className={`p-6 rounded-2xl space-y-2 shadow-lg ${
    darkMode ? "bg-slate-800 border border-slate-700" : "bg-gray-100 border"
  }`}
>
          <h2 className="text-lg font-semibold">Company Statement</h2>

          <p>Billing Period: {currentMonth}</p>
          <p>
            Previous Due: ₹{
              Object.values(carryForward).reduce((a:any,b:any)=>a+b,0)
            }
          </p>
          <p>New Company Expenses: ₹{companyPayments}</p>
          <p>Total Founder Payments: ₹{founderPayments}</p>

          <p className="text-2xl font-bold text-indigo-400">
            TOTAL DUE: ₹{
              (
                companyPayments -
                founderPayments +
                Object.values(carryForward).reduce((a:any,b:any)=>a+b,0)
              ).toFixed(2)
            }
          </p>

          <p>Cycle Ends: {formatDate(getCycleEndDate())}</p>
          <p>Due Date: {formatDate(getDueDate())}</p>

          <p>
            {isOverdue()
              ? "🔴 OVERDUE"
              : balances.some(b => Math.abs(b.balance) > 1)
              ? "🟡 Payment Pending"
              : "🟢 Settled"}
          </p>
        </div>

        <button
          onClick={resetMonth}
          className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-xl font-medium text-white shadow-sm transition"
        >
          Reset Month
        </button>

        {/* BALANCES */}
        <div className="space-y-3">
          {balances
            .filter(b => Math.abs(b.balance) > 0.5)
            .map(b => (
              <div
  key={b.name}
 className={`p-6 rounded-2xl shadow-lg ${
    darkMode ? "bg-slate-800 border border-slate-700" : "bg-gray-100 border"
  }`}
>
                <p className="font-bold">{b.name}</p>
                <p>Total Paid: ₹{b.paid}</p>
                <p>Total Settled: ₹{settlementMap[b.name] || 0}</p>
                <p>Previous Due: ₹{carryForward[b.name] || 0}</p>

                <p className="font-semibold mt-1">
                  {b.balance > 0
                    ? `Company owes ₹${b.balance.toFixed(2)}`
                    : `Owes Company ₹${Math.abs(b.balance).toFixed(2)}`
                  }
                </p>


              </div>
            ))}
        </div>
{/* ===== RECORD TRANSFER (Paid By → Paid To) ===== */}
<div
  className={`p-6 rounded-2xl shadow-lg ${
    darkMode ? "bg-slate-800 border border-slate-700" : "bg-gray-100 border"
  }`}
>
  <h2 className="text-lg font-semibold mb-2">
    Record Settlement (Paid By → Paid To)
  </h2>

  {/* FROM */}
  <select
    value={fromAccount}
    onChange={e => setFromAccount(e.target.value)}
    className={`w-full p-2 rounded mb-2 ${
      darkMode ? "bg-slate-600 text-white" : "bg-white border"
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
    className={`w-full p-2 rounded mb-2 ${
      darkMode ? "bg-slate-600 text-white" : "bg-white border"
    }`}
  >
    <option value="">Paid To</option>
    {accounts.map(a => (
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
    className={`w-full p-2 rounded mb-2 ${
      darkMode ? "bg-slate-600 text-white" : "bg-white border"
    }`}
  />

  <button
    onClick={recordTransfer}
    className="w-full bg-indigo-600 hover:bg-indigo-700 py-2 rounded font-medium text-white"
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
    ? "bg-indigo-600 text-white shadow-sm"
    : darkMode
    ? "bg-slate-800 hover:bg-slate-700 border border-slate-700"
    : "bg-white hover:bg-gray-100 border"
}`}
          >
            Expenses
          </button>

          <button
            onClick={() => setActiveTab("settlements")}
            className={`px-5 py-2.5 rounded-xl font-medium transition ${
  activeTab === "expenses"
    ? "bg-indigo-600 text-white shadow-sm"
    : darkMode
    ? "bg-slate-800 hover:bg-slate-700 border border-slate-700"
    : "bg-white hover:bg-gray-100 border"
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
  theme={darkMode ? "darkProfessional" : "default"}
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
  theme={darkMode ? "darkProfessional" : "default"}
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

