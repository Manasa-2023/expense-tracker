"use client";

import { useState, useEffect } from "react";
import { db } from "../../src/lib/firebase";
import { collection, addDoc, getDocs, setDoc, doc } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { deleteDoc } from "firebase/firestore";
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
  
const getCurrentMonthKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const currentMonth = getCurrentMonthKey();

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
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
}, []);

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
const eachShare = parseFloat(
  (companyPayments / founders.length).toFixed(2)
) || 0;

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
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  return due;
};

// DATE FORMAT
const formatDate = (date: Date) => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`; // DD/MM/YYYY
};

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* LEFT PANEL */}
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h1 className="text-2xl font-bold mb-4">Add Expense</h1>

          <input
            className="w-full border p-2 rounded mb-3"
            placeholder="Expense Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <input
            className="w-full border p-2 rounded mb-3"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />

          <select
            className="w-full border p-2 rounded mb-4"
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
            className="w-full bg-blue-600 text-white p-2 rounded"
          >
            Add Expense
          </button>
        </div>

        {/* RIGHT PANEL */}
        <div className="bg-white shadow-lg rounded-xl p-6">
{/* ===== STATEMENT SUMMARY CARD ===== */}
<div className="bg-indigo-600 text-white p-6 rounded-xl mb-6">
  <h2 className="text-xl font-bold mb-2">Company Statement</h2>

  <p>Billing Period: {currentMonth}</p>

  <p>Previous Due: ₹{
    Object.values(carryForward).reduce((a: any, b: any) => a + b, 0)
  }</p>

  <p>New Company Expenses: ₹{companyPayments}</p>

  <p>Total Founder Payments: ₹{founderPayments}</p>

  <p className="text-lg font-bold mt-2">
    TOTAL DUE: ₹{
      (
        companyPayments -
        founderPayments +
        Object.values(carryForward).reduce((a: any, b: any) => a + b, 0)
      ).toFixed(2)
    }
  </p>

  <p className="mt-2">
    Due Date: {formatDate(getDueDate())}
  </p>
</div>

          <h2 className="text-xl font-bold mb-2">Monthly Summary</h2>
          <p className="mt-3 font-semibold">
  Company Net Position: ₹{
    (founderPayments - companyPayments).toFixed(2)
  }
</p>

          <button
  onClick={resetMonth}
  className="bg-red-600 text-white px-4 py-2 rounded mt-3"
>
  Reset Month
</button>

         <p>Total Founder Payments: ₹{founderPayments}</p>
         <p>Total Company Payments: ₹{companyPayments}</p>
         <p>Each Founder Share (Company Expenses): ₹{eachShare.toFixed(2)}</p>

          <p>
  Due Date: {formatDate(getDueDate())}
</p>
<p className="mt-2">
  Status: {
    Object.values(balances).some(b => Math.abs(b.balance) > 1)
      ? "⚠ Payment Pending"
      : "✅ Settled"
  }
</p>

          {/* BALANCES */}
          <div className="mt-4">
            {balances
              .filter(b => Math.abs(b.balance) > 0.5)
              .map(b => (
                <div key={b.name} className="border p-3 rounded mb-2">

                  <p className="font-semibold">{b.name}</p>
                  <p>Total Paid: ₹{b.paid}</p>
                  <p>Total Settled: ₹{settlementMap[b.name] || 0}</p>
<p>Previous Due: ₹{carryForward[b.name] || 0}</p>

                  <p>
                    {b.balance > 0
                      ? `Company owes ₹${b.balance.toFixed(2)}`
                      : `Owes Company ₹${Math.abs(b.balance).toFixed(2)}`
                    }
                  </p>

                  {b.balance < -1 && (
                    <button
                      onClick={() =>
                        markAsPaid(b.name, Math.abs(b.balance))
                      }
                      className="mt-2 bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Mark Paid
                    </button>
                  )}

                </div>
              ))}
          </div>

          {/* TAB BUTTONS */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setActiveTab("expenses")}
              className={`px-4 py-2 rounded ${
                activeTab === "expenses"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200"
              }`}
            >
              Expenses
            </button>

            <button
              onClick={() => setActiveTab("settlements")}
              className={`px-4 py-2 rounded ${
                activeTab === "settlements"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200"
              }`}
            >
              Settlements
            </button>
          </div>

          {/* EXPENSE TABLE */}
          {activeTab === "expenses" && (
            <>
              <hr className="my-6" />
              <h2 className="text-xl font-bold mb-2">Expense History</h2>

              <div className="max-h-72 overflow-y-auto">
                <table className="w-full border">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border p-2">Title</th>
                      <th className="border p-2">Amount</th>
                      <th className="border p-2">Paid By</th>
                      <th className="border p-2">Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp.id}>
                        <td className="border p-2">{exp.title}</td>
                        <td className="border p-2">₹{exp.amount}</td>
                        <td className="border p-2">{exp.paidBy}</td>
                        <td className="border p-2">
                          {exp.createdAt
                            ? formatDate(new Date(exp.createdAt.seconds * 1000))
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* SETTLEMENT TABLE */}
          {activeTab === "settlements" && (
            <>
              <hr className="my-6" />
              <h2 className="text-xl font-bold mb-2">Settlement History</h2>

              <div className="max-h-72 overflow-y-auto">
                <table className="w-full border">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border p-2">Founder</th>
                      <th className="border p-2">Amount Paid</th>
                      <th className="border p-2">Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {settlements.map(s => (
                      <tr key={s.id}>
                        <td className="border p-2">{s.founder}</td>
                        <td className="border p-2">₹{s.amount}</td>
                        <td className="border p-2">
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