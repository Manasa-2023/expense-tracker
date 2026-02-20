"use client";

import { useState, useEffect } from "react";
import { db } from "@/src/lib/firebase";
import { collection, addDoc, getDocs, setDoc, doc } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
//import { deleteDoc } from "firebase/firestore";
import { deleteDoc, updateDoc } from "firebase/firestore";


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
  if (settlementMap[s.founder] !== undefined) {
    settlementMap[s.founder] += s.amount;
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

  /* ---------------- MARK PAID ---------------- */

  const markAsPaid = async (founderName: string, amount: number) => {
    if (amount <= 0) return;

    await addDoc(collection(db, "months", currentMonth, "settlements"), {
      founder: founderName,
      amount,
      settledAt: serverTimestamp()
    });

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

  /* ---------------- UI ---------------- */

  return (
  <div
  className={`min-h-screen p-6 transition-colors duration-300 ${
    darkMode
      ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white"
      : "bg-gradient-to-br from-gray-100 to-white text-gray-900"
  }`}
>

    {/* HEADER */}
<div className="flex justify-between items-center mb-6">
  <h1 className="text-3xl font-bold">Expense Dashboard</h1>

  <button
    onClick={() => setDarkMode(!darkMode)}
    className={`px-4 py-2 rounded-lg font-semibold ${
      darkMode
        ? "bg-yellow-400 text-black hover:bg-yellow-300"
        : "bg-slate-800 text-white hover:bg-slate-700"
    }`}
  >
    {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
  </button>
</div>

    {/* MONTH NAVIGATION */}
    <div className="flex justify-center items-center gap-4 mb-6">
      <button
        className={`px-4 py-2 rounded-lg ${
  darkMode
    ? "bg-slate-700 hover:bg-slate-600"
    : "bg-gray-200 hover:bg-gray-300 text-black"
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
        className={`px-4 py-2 rounded-lg ${
  darkMode
    ? "bg-slate-700 hover:bg-slate-600"
    : "bg-gray-200 hover:bg-gray-300 text-black"
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

    <div className="grid md:grid-cols-2 gap-6">

      {/* LEFT — ADD EXPENSE */}
      <div
  className={`rounded-xl p-6 shadow-xl backdrop-blur-sm space-y-4 ${
    darkMode ? "bg-slate-800" : "bg-white border"
  }`}
>
        <h2 className="text-xl font-semibold">Add Expense</h2>

        <input
          className={`w-full p-3 rounded ${
  darkMode
    ? "bg-slate-700 text-white"
    : "bg-gray-100 text-black border"
}`}
          placeholder="Expense Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          className={`w-full p-3 rounded ${
  darkMode
    ? "bg-slate-700 text-white"
    : "bg-gray-100 text-black border"
}`}
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <select
          className={`w-full p-3 rounded ${
  darkMode
    ? "bg-slate-700 text-white"
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
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
        >
          Add Expense
        </button>
      </div>

      {/* RIGHT PANEL */}
      <div className={`rounded-xl p-6 shadow-xl backdrop-blur-sm space-y-6 ${ darkMode ? "bg-slate-800" : "bg-white border"}`}>

        {/* KPI GRID */}
        <div className="grid grid-cols-2 gap-4">

          <div
  className={`p-4 rounded-lg ${
    darkMode ? "bg-slate-700" : "bg-gray-100 border"
  }`}
>
            <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Company Expenses</p>
            <p className="text-xl font-bold">
              ₹{companyPayments.toLocaleString("en-IN")}
            </p>
          </div>

          <div
  className={`p-4 rounded-lg ${
    darkMode ? "bg-slate-700" : "bg-gray-100 border"
  }`}
>
           <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Founder Payments</p>
            <p className="text-xl font-bold">
              ₹{founderPayments.toLocaleString("en-IN")}
            </p>
          </div>

          <div
  className={`p-4 rounded-lg ${
    darkMode ? "bg-slate-700" : "bg-gray-100 border"
  }`}
>
            <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>Each Share</p>
            <p className="text-xl font-bold">
              ₹{eachShare.toLocaleString("en-IN")}
            </p>
          </div>

          <div
  className={`p-4 rounded-lg ${
    darkMode ? "bg-slate-700" : "bg-gray-100 border"
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
  className={`p-4 rounded-lg space-y-1 ${
    darkMode ? "bg-slate-700" : "bg-gray-100 border"
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

          <p className="text-2xl font-bold text-green-400">
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
          className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-semibold"
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
  className={`p-4 rounded-lg ${
    darkMode ? "bg-slate-700" : "bg-gray-100 border"
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

                {b.balance < -1 && (
                  <button
                    onClick={() => markAsPaid(b.name, Math.abs(b.balance))}
                    className="mt-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            ))}
        </div>

        {/* TAB BUTTONS */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2 rounded-lg ${
              activeTab === "expenses"
                ? "bg-blue-600"
                : darkMode
  ? "bg-slate-700 hover:bg-slate-600"
  : "bg-gray-200 hover:bg-gray-300 text-black"
            }`}
          >
            Expenses
          </button>

          <button
            onClick={() => setActiveTab("settlements")}
            className={`px-4 py-2 rounded-lg ${
              activeTab === "settlements"
                ? "bg-blue-600"
                : darkMode
  ? "bg-slate-700 hover:bg-slate-600"
  : "bg-gray-200 hover:bg-gray-300 text-black"
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
              className={`w-full p-2 rounded mb-3 ${
  darkMode
    ? "bg-slate-700 text-white"
    : "bg-gray-100 text-black border"
}`}
              onChange={e => setSearch(e.target.value)}
            />

            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead className={darkMode ? "bg-slate-700" : "bg-gray-200"}>
                  <tr>
                    <th className="p-2 text-left">Title</th>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Paid By</th>
                    <th className="p-2 text-left">Date / Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedExpenses.map(exp => (
                    <tr
  key={exp.id}
  className={`border-b ${
    darkMode ? "border-slate-700" : "border-gray-300"
  }`}
>

                      {/* TITLE */}
                      <td className="p-2">
                        {editingId === exp.id ? (
                          <input
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className={`w-full p-1 rounded ${
  darkMode
    ? "bg-slate-600 text-white"
    : "bg-white border text-black"
}`}
                          />
                        ) : exp.title}
                      </td>

                      {/* AMOUNT */}
                      <td className="p-2">
                        {editingId === exp.id ? (
                          <input
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            className={`w-full p-1 rounded ${
  darkMode
    ? "bg-slate-600 text-white"
    : "bg-white border text-black"
}`}
                          />
                        ) : `₹${exp.amount}`}
                      </td>

                      {/* PAID BY */}
                      <td className="p-2">
                        {editingId === exp.id ? (
                          <select
                            value={editPaidBy}
                            onChange={e => setEditPaidBy(e.target.value)}
                            className={`p-1 rounded ${
  darkMode
    ? "bg-slate-600 text-white"
    : "bg-white border text-black"
}`}
                          >
                            <option value="Founder1">Founder1</option>
                            <option value="Founder2">Founder2</option>
                            <option value="Founder3">Founder3</option>
                            <option value="Company">Company</option>
                          </select>
                        ) : exp.paidBy}
                      </td>

                      {/* DATE + ACTIONS */}
                      <td className="p-2">
                        {exp.createdAt
                          ? formatDate(new Date(exp.createdAt.seconds * 1000))
                          : "N/A"}

                        <div className="flex gap-2 mt-1">

                          {editingId === exp.id ? (
                            <>
                              <button
                                onClick={() => saveEdit(exp.id)}
                                className="bg-green-600 px-2 py-1 rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="bg-gray-500 px-2 py-1 rounded"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(exp)}
                                className="bg-blue-600 px-2 py-1 rounded"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteExpense(exp.id)}
                                className="bg-red-600 px-2 py-1 rounded"
                              >
                                Delete
                              </button>
                            </>
                          )}

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ================= SETTLEMENT TABLE ================= */}
        {activeTab === "settlements" && (
          <>
            <h2 className="text-xl font-semibold mt-4">
              Settlement History
            </h2>

            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead className={darkMode ? "bg-slate-700" : "bg-gray-200"}>
                  <tr>
                    <th className="p-2 text-left">Founder</th>
                    <th className="p-2 text-left">Amount Paid</th>
                    <th className="p-2 text-left">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedSettlements.map(s => (
                    <tr
  key={s.id}
  className={`border-b ${
    darkMode ? "border-slate-700" : "border-gray-300"
  }`}
>
                      <td className="p-2">{s.founder}</td>
                      <td className="p-2">₹{s.amount}</td>
                      <td className="p-2">
                        {s.settledAt
                          ? formatDate(new Date(s.settledAt.seconds * 1000))
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  </div>
);

}
