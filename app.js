import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, writeBatch, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDM-FWxsSkNOCXdGbc5cQ5H1_jmGiBby10",
  authDomain: "rudrastore-46f12.firebaseapp.com",
  projectId: "rudrastore-46f12",
  storageBucket: "rudrastore-46f12.firebasestorage.app",
  messagingSenderId: "654233322525",
  appId: "1:654233322525:web:7992c94a1b362f07cd72f4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.db = db;
window.doc = doc;
window.collection = collection;
window.setDoc = setDoc;
window.getDoc = getDoc;

let unsubInventory = null;
let unsubTransactions = null;
let unsubCustomers = null; 
let unsubSuppliers = null; 
let allTransactions = [];
let allInventory = []; 
let allCustomers = []; 
let allSuppliers = []; 
let purchaseCart = []; 
let myChartMonthly = null;
let myChartABC = null;
let myChartFSN = null;

const todayStr = new Date().toISOString().split('T')[0];
document.getElementById('filter-trans-start').value = todayStr;
document.getElementById('filter-trans-end').value = todayStr;
if(document.getElementById('purchase-date')) {
    document.getElementById('purchase-date').value = todayStr;
}

function showSuccessAnimation(msg = "Success!") {
    const overlay = document.getElementById('success-overlay');
    const card = document.getElementById('success-card');
    const iconContainer = document.getElementById('success-icon-container');
    document.getElementById('success-msg').innerText = msg;
    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100', 'pointer-events-auto');
    card.classList.remove('scale-50');
    card.classList.add('scale-100');
    iconContainer.style.animation = 'none';
    void iconContainer.offsetWidth; 
    iconContainer.style.animation = null;
    setTimeout(() => {
        overlay.classList.remove('opacity-100', 'pointer-events-auto');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        card.classList.remove('scale-100');
        card.classList.add('scale-50');
        setTimeout(() => { overlay.classList.add('hidden'); }, 300);
    }, 2000);
}

let globalYearFilter = "All";
document.getElementById('global-year-filter').addEventListener('change', (e) => {
    globalYearFilter = e.target.value;
    if (document.getElementById('dash-year-label')) {
        document.getElementById('dash-year-label').innerText = `(${globalYearFilter === 'All' ? 'All Years' : globalYearFilter})`;
    }
    updateDashboardMetrics();
    renderTransactionsTable();
    renderDashboardTopItems();
    if (document.getElementById('tab-analytics').classList.contains('active')) runAnalytics();
});

function isYearMatch(dateStr) {
    if (globalYearFilter === "All") return true;
    if (!dateStr) return false;
    return new Date(dateStr).getFullYear().toString() === globalYearFilter;
}

function updateYearDropdown(transactions) {
    const selectEl = document.getElementById('global-year-filter');
    const currentVal = selectEl.value;
    const years = new Set();
    transactions.forEach(t => {
        if(t.date) {
            const year = new Date(t.date).getFullYear().toString();
            years.add(year);
        }
    });
    let html = `<option value="All">All Years</option>`;
    Array.from(years).sort((a,b) => b - a).forEach(year => { html += `<option value="${year}">${year}</option>`; });
    selectEl.innerHTML = html;
    if (years.has(currentVal) || currentVal === "All") {
        selectEl.value = currentVal;
    } else {
        globalYearFilter = "All";
        selectEl.value = "All";
    }
}

const btnThemeToggle = document.getElementById('btn-theme-toggle');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    btnThemeToggle.innerText = "Switch to Light Mode";
}
btnThemeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    btnThemeToggle.innerText = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if(myChartMonthly) renderCharts(lastMonthlyData, lastAbcTotals, lastFsnTotals);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        startDatabaseListeners();
        setupPredictiveSearch('sale-item', 'sale-item-dropdown', true);
        setupPredictiveSearch('purchase-item', 'purchase-item-dropdown', false);
        setupCustomerSearch(); 
      setupSupplierSearch();
    } else {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        stopDatabaseListeners();
    }
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('form-login').reset();
    } catch (error) {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-error').innerText = "Error: Invalid Credentials.";
    }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

const tabs = ['dashboard', 'transactions', 'analytics', 'sales', 'purchases', 'inventory', 'settings'];
tabs.forEach(tab => {
    const btn = document.getElementById(`btn-${tab}`);
    if(btn) {
        btn.addEventListener('click', () => {
            tabs.forEach(t => {
                const tabEl = document.getElementById(`tab-${t}`);
                const btnEl = document.getElementById(`btn-${t}`);
                if(tabEl) tabEl.classList.remove('active');
                if(btnEl) btnEl.classList.remove('active');
            });
            document.getElementById(`tab-${tab}`).classList.add('active');
            document.getElementById(`btn-${tab}`).classList.add('active');
            if(tab === 'analytics') setTimeout(runAnalytics, 10); 
        });
    }
});

let currentInventorySearch = "";
let currentInventoryFilter = "all";

function startDatabaseListeners() {
    // Customers Listener
    unsubCustomers = onSnapshot(collection(db, "customers"), (snapshot) => {
        allCustomers = [];
        snapshot.forEach((doc) => { const c = doc.data(); c.id = doc.id; allCustomers.push(c); });
    });

    // NEW: Suppliers Listener
    unsubSuppliers = onSnapshot(collection(db, "suppliers"), (snapshot) => {
        allSuppliers = [];
        snapshot.forEach((doc) => { const s = doc.data(); s.id = doc.id; allSuppliers.push(s); });
    });
    
  

   unsubInventory = onSnapshot(collection(db, "inventory"), (snapshot) => {
        allTransactions = [];
        snapshot.forEach((docSnap) => {
            const trans = docSnap.data();
            trans.id = docSnap.id; 
            allTransactions.push(trans);
        });
        updateYearDropdown(allTransactions);
        renderTransactionsTable();
        updateDashboardMonths(allTransactions);
        renderDashboardTopItems();
        updateDashboardMetrics();
        if (document.getElementById('tab-analytics').classList.contains('active')) runAnalytics();
    });
}

function stopDatabaseListeners() {
    if (unsubInventory) unsubInventory();
    if (unsubTransactions) unsubTransactions();
    if (unsubCustomers) unsubCustomers(); 
  if (unsubSuppliers) unsubSuppliers();
}

function setupPredictiveSearch(inputId, dropdownId, isSale) {
    const inputEl = document.getElementById(inputId);
    const dropdownEl = document.getElementById(dropdownId);

    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.classList.add('hidden');
        }
    });

    inputEl.addEventListener('focus', () => renderDropdown());
    inputEl.addEventListener('input', () => {
        renderDropdown();
        if (isSale) {
            const typedName = inputEl.value.trim().toLowerCase();
            const foundItem = allInventory.find(item => item.name.toLowerCase() === typedName);
            document.getElementById('sale-cost').value = foundItem ? foundItem.price : '';
        }
    });

    function renderDropdown() {
        const queryStr = inputEl.value.toLowerCase().trim();
        let filtered = allInventory;
        if (queryStr) {
            filtered = allInventory.filter(item => item.name.toLowerCase().includes(queryStr));
        }

        let html = '';
        if (filtered.length === 0) {
            html = `<div class="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">No inventory items found.</div>`;
            if (!isSale && queryStr) {
                html += `<div class="px-4 py-3 bg-danger/10 text-danger cursor-pointer font-semibold text-sm hover:bg-danger hover:text-white transition-colors dropdown-item" data-name="${inputEl.value}" data-price="0" data-gst="" data-part="">
                    <i class="fa-solid fa-plus mr-2"></i> Add as new item: "${inputEl.value}"
                </div>`;
            }
            dropdownEl.innerHTML = html;
            dropdownEl.classList.remove('hidden');
            attachClicks();
            return;
        }

        const grouped = { "🟢 In Stock": [], "🟠 Low Stock": [], "🔴 Out of Stock": [] };
        filtered.forEach(item => {
            const qty = Number(item.qty);
            if (qty === 0) grouped["🔴 Out of Stock"].push(item);
            else if (qty <= 3) grouped["🟠 Low Stock"].push(item);
            else grouped["🟢 In Stock"].push(item);
        });

        for (const [category, items] of Object.entries(grouped)) {
            if (items.length > 0) {
                html += `<div class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700/80 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10 border-y border-gray-200 dark:border-gray-600">${category}</div>`;
                items.forEach(item => {
                    const priceStr = Number(item.price).toFixed(2);
                    const gstAttr = item.hasGST ? 'true' : '';
                    const partAttr = item.partNumber || '';
                    html += `
                    <div class="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600/50 cursor-pointer flex justify-between items-center dropdown-item border-b border-gray-50 dark:border-gray-700 dark:last:border-0 transition-colors" data-name="${item.name}" data-price="${item.price}" data-gst="${gstAttr}" data-part="${partAttr}">
                        <div class="flex flex-col">
                            <span class="font-semibold text-sm text-gray-800 dark:text-gray-100">${item.name}</span>
                            ${partAttr ? `<span class="text-[10px] text-gray-400">PN: ${partAttr}</span>` : ''}
                        </div>
                        <div class="text-right">
                            <span class="block text-xs text-gray-500 dark:text-gray-400">Stock: ${item.qty}</span>
                            <span class="block text-xs font-bold text-primary">₹${priceStr}</span>
                        </div>
                    </div>`;
                });
            }
        }
        dropdownEl.innerHTML = html;
        dropdownEl.classList.remove('hidden');
        attachClicks();
    }

    function attachClicks() {
        dropdownEl.querySelectorAll('.dropdown-item').forEach(el => {
            el.addEventListener('click', () => {
                inputEl.value = el.getAttribute('data-name');
                dropdownEl.classList.add('hidden');
                if (isSale) {
                    document.getElementById('sale-cost').value = el.getAttribute('data-price');
                } else {
                    document.getElementById('purchase-gst').checked = !!el.getAttribute('data-gst');
                    if (document.getElementById('purchase-part')) {
                        document.getElementById('purchase-part').value = el.getAttribute('data-part') || '';
                    }
                }
            });
        });
    }
}

function updateDashboardMetrics() {
    if (!allInventory || !allTransactions) return;
    const todayISO = new Date().toISOString().split('T')[0];
    
    let invMap = {};
    let invValue = 0;
    let lowStockCount = 0;
    let totalStockUnits = 0;

    allInventory.forEach(item => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        invMap[item.name] = { cost: price };
        invValue += (qty * price);
        totalStockUnits += qty;
        if (qty <= 3) lowStockCount++;
    });

    let todaySales = 0, todayCogs = 0, todayItemsSold = 0;
    let overallSales = 0, overallCogs = 0;
    let todayItemTrends = {};

    allTransactions.forEach(t => {
        if (!isYearMatch(t.date)) return;
        const tDateISO = t.date.split('T')[0];
        const isToday = (tDateISO === todayISO);
        const amt = Number(t.amount) || 0;
        const qty = Number(t.qty) || 0;

        if (t.type === 'Sale' || t.type === 'Cosmetic Sale') {
            overallSales += amt;
            let cost = t.type === 'Sale' ? ((invMap[t.item]?.cost || 0) * qty) : ((Number(t.cost) || 0) * qty);
            overallCogs += cost;

            if (isToday) {
                todaySales += amt;
                todayCogs += cost;
                todayItemsSold += qty;
                todayItemTrends[t.item] = (todayItemTrends[t.item] || 0) + qty; 
            }
        } else if (t.type === 'Sale Return' || t.type === 'Cosmetic Return') {
            overallSales -= amt;
            let cost = t.type === 'Sale Return' ? ((invMap[t.item]?.cost || 0) * qty) : ((Number(t.cost) || 0) * qty);
            overallCogs -= cost;

            if (isToday) {
                todaySales -= amt;
                todayCogs -= cost;
                todayItemsSold -= qty; 
                todayItemTrends[t.item] = (todayItemTrends[t.item] || 0) - qty;
            }
        }
    });

    let todayProfit = todaySales - todayCogs;
    let todayMargin = todaySales > 0 ? ((todayProfit / todaySales) * 100).toFixed(1) : 0;
    let overallProfit = overallSales - overallCogs;

    let trendingItem = "N/A";
    let maxQty = 0;
    for (const [itemName, count] of Object.entries(todayItemTrends)) {
        if (count > maxQty) {
            maxQty = count;
            trendingItem = itemName;
        }
    }

    if (document.getElementById('dash-today-sales')) {
        document.getElementById('dash-today-sales').innerText = `₹${todaySales.toFixed(2)}`;
        document.getElementById('dash-today-profit').innerText = `₹${todayProfit.toFixed(2)}`;
        document.getElementById('dash-today-margin').innerText = `${todayMargin}%`;
        document.getElementById('dash-today-items').innerText = todayItemsSold;
        document.getElementById('dash-today-trending').innerText = trendingItem;
        document.getElementById('dash-overall-revenue').innerText = `₹${overallSales.toFixed(2)}`;
        document.getElementById('dash-overall-profit').innerText = `₹${overallProfit.toFixed(2)}`;
        document.getElementById('dash-inv-value').innerText = `₹${invValue.toFixed(2)}`;
        document.getElementById('dash-low-stock').innerText = lowStockCount;
        document.getElementById('dash-inventory').innerText = totalStockUnits;
    }
}

const dashMonthSelect = document.getElementById('dash-top-month');
const dashTypeSelect = document.getElementById('dash-top-type');
dashMonthSelect.addEventListener('change', renderDashboardTopItems);
dashTypeSelect.addEventListener('change', renderDashboardTopItems);

function updateDashboardMonths(transactions) {
    const currentSelection = dashMonthSelect.value;
    let monthsSet = new Set();
    monthsSet.add(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
    transactions.forEach(t => {
        if (!isYearMatch(t.date)) return; 
        const d = new Date(t.date);
        monthsSet.add(d.toLocaleString('default', { month: 'long', year: 'numeric' }));
    });
    let html = ''; 
    Array.from(monthsSet).forEach(m => { html += `<option value="${m}">${m}</option>`; });
    dashMonthSelect.innerHTML = html;
    if (currentSelection && monthsSet.has(currentSelection)) dashMonthSelect.value = currentSelection;
}

function renderDashboardTopItems() {
    const selectedMonth = dashMonthSelect.value;
    const selectedType = dashTypeSelect.value;
    const listContainer = document.getElementById('dash-top-list');
    let itemSalesMap = {};

    allTransactions.forEach(t => {
        if (!isYearMatch(t.date)) return;
        if (!t.type.includes('Sale')) return;
        if (selectedType !== 'All' && t.type !== selectedType) return;
        const tDate = new Date(t.date);
        const monthKey = tDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (selectedMonth !== 'All' && monthKey !== selectedMonth) return;

        if (!itemSalesMap[t.item]) itemSalesMap[t.item] = 0;
        if (t.type === 'Sale' || t.type === 'Cosmetic Sale') itemSalesMap[t.item] += Number(t.qty);
        else if (t.type === 'Sale Return' || t.type === 'Cosmetic Return') itemSalesMap[t.item] -= Number(t.qty);
    });

    let sortedItems = Object.keys(itemSalesMap)
        .map(itemName => ({ name: itemName, sold: itemSalesMap[itemName] }))
        .filter(item => item.sold > 0) 
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 10); 

    listContainer.innerHTML = '';
    if (sortedItems.length === 0) {
        listContainer.innerHTML = `<li class="text-center py-6 text-gray-500">No sales found for this filter.</li>`;
        return;
    }

    let rank = 1;
    sortedItems.forEach(item => {
        let rankColor = rank === 1 ? '#f59e0b' : (rank === 2 ? '#9ca3af' : (rank === 3 ? '#b45309' : '#6b7280'));
        let rankIcon = rank <= 3 ? `<i class="fa-solid fa-medal" style="color: ${rankColor}"></i>` : `<span class="inline-block w-5 text-center text-white rounded-full text-xs leading-5" style="background:${rankColor}">${rank}</span>`;
        listContainer.innerHTML += `
            <li class="flex justify-between items-center py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                <div class="text-sm font-medium"><span class="mr-3">${rankIcon}</span> ${item.name}</div>
                <div class="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded">${item.sold} sold</div>
            </li>`;
        rank++;
    });
}

document.getElementById('btn-trans-filter').addEventListener('click', renderTransactionsTable);
document.getElementById('btn-trans-clear').addEventListener('click', () => { 
    document.getElementById('filter-trans-start').value = ''; 
    document.getElementById('filter-trans-end').value = ''; 
    document.getElementById('filter-trans-gst').value = 'All';
    renderTransactionsTable(); 
});

function renderTransactionsTable() {
    const startVal = document.getElementById('filter-trans-start').value; 
    const endVal = document.getElementById('filter-trans-end').value;
    const gstFilter = document.getElementById('filter-trans-gst').value;
    let sD = startVal ? new Date(startVal + 'T00:00:00') : null; 
    let eD = endVal ? new Date(endVal + 'T23:59:59') : null;
    let html = [];

    allTransactions.forEach((t) => {
        if (!isYearMatch(t.date)) return;
        const tDate = new Date(t.date);
        if (sD && tDate < sD) return; 
        if (eD && tDate > eD) return;
        
        if (gstFilter === 'GST' && !t.hasGST) return;
        if (gstFilter === 'Non-GST' && t.hasGST) return;
        
        let tColorClass = t.type.includes('Sale') ? (t.type.includes('Cosmetic') ? 'text-cosmetic' : 'text-success') : (t.type.includes('Purchase') ? 'text-danger' : 'text-warning');
        let actionBtn = (t.type === 'Sale' || t.type === 'Purchase' || t.type === 'Cosmetic Sale') 
            ? `<button class="btn-return bg-warning/20 hover:bg-warning text-warning hover:text-white px-3 py-1 rounded text-xs font-bold transition-colors" data-id="${t.id}">Return</button>`
            : `<span class="text-xs text-gray-400 font-medium italic">Returned</span>`;
            
        let gstBadge = t.hasGST ? `<span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold uppercase">GST</span>` : '';
        
        let extraInfo = '';
        if (t.type === 'Purchase') {
            if (t.supplier) extraInfo += `<span class="block text-[10px] text-gray-500 mt-0.5">Supp: ${t.supplier} | Inv: ${t.invoice || 'N/A'}</span>`;
        }

        html.push(`
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">${tDate.toLocaleDateString()}</td>
            <td class="px-6 py-4 whitespace-nowrap font-bold ${tColorClass}">${t.type}</td>
            <td class="px-6 py-4">
                <div class="flex items-center">${t.item || "Unknown"} ${gstBadge}</div>
                ${extraInfo}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${Number(t.qty) || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap font-semibold">₹${(Number(t.amount) || 0).toFixed(2)}</td>
            <td class="px-6 py-4 text-center whitespace-nowrap">${actionBtn}</td>
        </tr>`);
    });
    document.querySelector('#table-transactions tbody').innerHTML = html.join('');
}

document.querySelector('#table-transactions tbody').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-return')) {
        const btn = e.target;
        if (btn.disabled) return;
        const id = btn.getAttribute('data-id');
        const t = allTransactions.find(x => x.id === id);
        if (!t) return;

        let returnQtyStr = prompt(`How many '${t.item}' do you want to return?\n(Original Quantity: ${t.qty})`, t.qty);
        if (returnQtyStr === null) return; 
        let returnQty = parseInt(returnQtyStr);
        if (isNaN(returnQty) || returnQty <= 0 || returnQty > t.qty) {
            alert(`Invalid quantity! Must be between 1 and ${t.qty}`);
            return;
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        btn.classList.add('opacity-50', 'cursor-not-allowed');

        let returnAmount = (t.amount / t.qty) * returnQty;

        try {
            const batch = writeBatch(db);
            if (returnQty === t.qty) {
                batch.delete(doc(db, "transactions", t.id));
            } else {
                batch.update(doc(db, "transactions", t.id), { qty: t.qty - returnQty, amount: t.amount - returnAmount });
            }
            if (t.type !== 'Cosmetic Sale') {
                const localInvItem = allInventory.find(i => i.name === t.item);
                if (localInvItem) {
                    let currentStock = Number(localInvItem.qty);
                    let newStock = currentStock;
                    if (t.type === 'Sale') newStock += returnQty; 
                    else if (t.type === 'Purchase') newStock -= returnQty; 
                    if(newStock < 0) newStock = 0;
                    batch.update(doc(db, "inventory", localInvItem.id), { qty: newStock });
                }
            }
            await batch.commit(); 
            showSuccessAnimation("Return Processed Successfully!");
        } catch (err) {
            console.error(err);
            alert("Error processing the return.");
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
});

document.getElementById('btn-ana-filter').addEventListener('click', runAnalytics);
document.getElementById('btn-ana-clear').addEventListener('click', () => { document.getElementById('ana-start').value = ''; document.getElementById('ana-end').value = ''; runAnalytics(); });
document.getElementById('btn-ana-today').addEventListener('click', () => { const today = new Date().toISOString().split('T')[0]; document.getElementById('ana-start').value = today; document.getElementById('ana-end').value = today; runAnalytics(); });
document.getElementById('ana-class-filter').addEventListener('change', runAnalytics);
document.getElementById('filter-top-selling').addEventListener('change', runAnalytics);
document.getElementById('filter-inv-status').addEventListener('change', runAnalytics);

let lastMonthlyData = {}; let lastAbcTotals = {}; let lastFsnTotals = {};

function runAnalytics() {
    if(!document.getElementById('tab-analytics').classList.contains('active')) return;
    const startVal = document.getElementById('ana-start').value; const endVal = document.getElementById('ana-end').value;
    let startDate = startVal ? new Date(startVal + 'T00:00:00') : null; let endDate = endVal ? new Date(endVal + 'T23:59:59') : null;

    let revenue = 0; let cogs = 0; 
    let itemStats = {}; 
    let monthlyData = {};

    allInventory.forEach(inv => { itemStats[inv.name] = { stock: inv.qty, unitCost: inv.price, invValue: (inv.qty * inv.price), qtySold: 0, totalRevenue: 0 }; });

    allTransactions.forEach(trans => {
        if (!isYearMatch(trans.date)) return;
        const tDate = new Date(trans.date);
        if (startDate && tDate < startDate) return; if (endDate && tDate > endDate) return;

        const monthKey = tDate.toLocaleString('default', { month: 'short', year: 'numeric' });
        if(!monthlyData[monthKey]) monthlyData[monthKey] = { sales: 0, profit: 0 };

        if(trans.type === 'Sale') {
            revenue += trans.amount; monthlyData[monthKey].sales += trans.amount;
            let cost = 0;
            if(itemStats[trans.item]) {
                cost = itemStats[trans.item].unitCost * trans.qty;
                itemStats[trans.item].qtySold += trans.qty;
                itemStats[trans.item].totalRevenue += trans.amount;
            }
            cogs += cost; monthlyData[monthKey].profit += (trans.amount - cost);
        } else if (trans.type === 'Cosmetic Sale') {
            revenue += trans.amount; monthlyData[monthKey].sales += trans.amount;
            let cost = (trans.cost || 0) * trans.qty; 
            cogs += cost; monthlyData[monthKey].profit += (trans.amount - cost);
        } else if (trans.type === 'Sale Return') {
            revenue -= trans.amount; monthlyData[monthKey].sales -= trans.amount;
            let cost = 0;
            if(itemStats[trans.item]) {
                cost = itemStats[trans.item].unitCost * trans.qty;
                itemStats[trans.item].qtySold -= trans.qty; 
                itemStats[trans.item].totalRevenue -= trans.amount;
            }
            cogs -= cost; monthlyData[monthKey].profit -= (trans.amount - cost);
        } else if (trans.type === 'Cosmetic Return') {
            revenue -= trans.amount; monthlyData[monthKey].sales -= trans.amount;
            let cost = (trans.cost || 0) * trans.qty;
            cogs -= cost; monthlyData[monthKey].profit -= (trans.amount - cost);
        }
    });

    let profit = revenue - cogs;
    let margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
    let totalStock = allInventory.reduce((acc, curr) => acc + Number(curr.qty || 0), 0);

    document.getElementById('ana-revenue').innerText = `₹${revenue.toFixed(2)}`;
    document.getElementById('ana-profit').innerText = `₹${profit.toFixed(2)}`;
    document.getElementById('ana-margin').innerText = `${margin}%`;
    document.getElementById('ana-stock').innerText = totalStock;

    let totalInvValue = 0; let abcArray = [];
    for (const[name, data] of Object.entries(itemStats)) { totalInvValue += data.invValue; abcArray.push({ name, value: data.invValue }); }
    abcArray.sort((a,b) => b.value - a.value);
    
    let cumValue = 0; let abcTotals = { A: 0, B: 0, C: 0 }; let abcHtml = [];
    abcArray.forEach(item => {
        cumValue += item.value; let pct = totalInvValue > 0 ? cumValue / totalInvValue : 0; let category = 'C'; let catClass = 'text-danger';
        if(pct <= 0.70) { abcTotals.A += item.value; category = 'A'; catClass = 'text-success'; }
        else if (pct <= 0.90) { abcTotals.B += item.value; category = 'B'; catClass = 'text-warning'; }
        else { abcTotals.C += item.value; category = 'C'; }
        abcHtml.push(`<tr><td class="py-3 px-4">${item.name}</td><td class="py-3 px-4">₹${item.value.toFixed(2)}</td><td class="py-3 px-4">${(pct * 100).toFixed(1)}%</td><td class="py-3 px-4 font-bold ${catClass}">${category}</td></tr>`);
    });
    document.querySelector('#table-abc tbody').innerHTML = abcHtml.join('');

    const filterTop = document.getElementById('filter-top-selling').value; let topHtml = [];
    let sortedTop = Object.keys(itemStats).map(k => ({name: k, sold: itemStats[k].qtySold})).sort((a,b) => b.sold - a.sold);
    if(filterTop === 'Top10') sortedTop = sortedTop.slice(0, 10);
    sortedTop.forEach(item => { if(item.sold > 0 || filterTop === 'All') topHtml.push(`<tr><td class="py-2 px-3">${item.name}</td><td class="py-2 px-3 text-right font-bold text-success">${item.sold}</td></tr>`); });
    document.getElementById('tbody-top-selling').innerHTML = topHtml.join('');

    const filterInv = document.getElementById('filter-inv-status').value; let invHtml = [];
    let sortedInv = Object.keys(itemStats).map(k => ({name: k, stock: itemStats[k].stock})).sort((a,b) => a.stock - b.stock);
    sortedInv.forEach(item => {
        if (filterInv === 'Low' && item.stock > 3) return; 
        invHtml.push(`<tr><td class="py-2 px-3">${item.name}</td><td class="py-2 px-3 text-right ${item.stock <= 3 ? 'text-danger font-bold' : ''}">${item.stock}</td></tr>`);
    });
    document.getElementById('tbody-inv-status').innerHTML = invHtml.join('');

    let fsnTotals = { F: 0, S: 0, N: 0 }; let matrixRows = [];
    let maxQtySold = Math.max(...Object.values(itemStats).map(i => i.qtySold), 0);
    let maxRev = Math.max(...Object.values(itemStats).map(i => i.totalRevenue), 0);

    for (const[name, data] of Object.entries(itemStats)) {
        let FSN = 'N'; if (data.qtySold > 0) FSN = data.qtySold >= (maxQtySold * 0.5) ? 'F' : 'S'; 
        fsnTotals[FSN] += data.stock;
        let HMV = 'V'; if (data.totalRevenue > 0) HMV = data.totalRevenue >= (maxRev * 0.5) ? 'H' : 'M'; 
        let actClass = "";
        if(FSN==='F' && HMV==='H') actClass = "⭐ Stars"; else if(FSN==='S' && HMV==='H') actClass = "💰 Cash Cows";
        else if(FSN==='N' && HMV==='H') actClass = "🔥 Dead Weight"; else if(FSN==='F' && HMV==='M') actClass = "🚀 Drivers";
        else if(FSN==='S' && HMV==='M') actClass = "🐢 Slugs"; else if(FSN==='N' && HMV==='M') actClass = "💤 Sleepers";
        else if(FSN==='F' && HMV==='V') actClass = "🏃 Runners"; else if(FSN==='S' && HMV==='V') actClass = "📦 Basics";
        else if(FSN==='N' && HMV==='V') actClass = "🗑️ Dead Stock";
        matrixRows.push({ name, stock: data.stock, invValue: data.invValue, rev: data.totalRevenue, FSN, HMV, actClass });
    }

    const filterClass = document.getElementById('ana-class-filter').value; let matrixHtml = [];
    matrixRows.sort((a,b) => b.rev - a.rev).forEach(row => {
        if(filterClass !== "All" && !row.actClass.includes(filterClass)) return;
        let fsnColor = row.FSN==='F'?'text-success':(row.FSN==='S'?'text-warning':'text-danger');
        let hmvColor = row.HMV==='H'?'text-primary':(row.HMV==='M'?'text-purple-500':'text-gray-500');
        matrixHtml.push(`<tr><td class="py-3 px-4 font-bold">${row.name}</td><td class="py-3 px-4">${row.stock}</td><td class="py-3 px-4">₹${row.invValue.toFixed(2)}</td><td class="py-3 px-4">₹${row.rev.toFixed(2)}</td><td class="py-3 px-4 font-bold ${fsnColor}">${row.FSN}</td><td class="py-3 px-4 font-bold ${hmvColor}">${row.HMV}</td><td class="py-3 px-4">${row.actClass}</td></tr>`);
    });
    document.querySelector('#table-matrix tbody').innerHTML = matrixHtml.join('');

    lastMonthlyData = monthlyData; lastAbcTotals = abcTotals; lastFsnTotals = fsnTotals;
    renderCharts(monthlyData, abcTotals, fsnTotals);
}

function renderCharts(monthlyData, abcTotals, fsnTotals) {
    if(myChartMonthly) myChartMonthly.destroy(); if(myChartABC) myChartABC.destroy(); if(myChartFSN) myChartFSN.destroy();
    const labelsMonth = Object.keys(monthlyData).reverse();
    const dataSales = labelsMonth.map(m => monthlyData[m].sales);
    const dataProfit = labelsMonth.map(m => monthlyData[m].profit);
    const isDark = document.body.classList.contains('dark-mode');
    const chartTextColor = isDark ? '#e0e0e0' : '#2c3e50';
    Chart.defaults.color = chartTextColor;

    myChartMonthly = new Chart(document.getElementById('chart-monthly'), {
        type: 'bar', data: { labels: labelsMonth.length ? labelsMonth : ["No Data"], datasets: [{ label: 'Sales (₹)', data: dataSales, backgroundColor: '#3b82f6' }, { label: 'Profit (₹)', data: dataProfit, backgroundColor: '#10b981' }] },
        options: { responsive: true, plugins: { title: { display: true, text: 'Monthly Sales vs Profit', color: chartTextColor } }, animation: { duration: 0 } }
    });
    myChartABC = new Chart(document.getElementById('chart-abc'), {
        type: 'doughnut', data: { labels: ['A (Top Value)', 'B (Medium)', 'C (Low)'], datasets: [{ data: [abcTotals.A, abcTotals.B, abcTotals.C], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] },
        options: { responsive: true, plugins: { title: { display: true, text: 'Inventory Value by ABC', color: chartTextColor } }, animation: { duration: 0 } }
    });
    myChartFSN = new Chart(document.getElementById('chart-fsn'), {
        type: 'pie', data: { labels: ['Fast Moving', 'Slow Moving', 'Non-Moving'], datasets: [{ data: [fsnTotals.F, fsnTotals.S, fsnTotals.N], backgroundColor: ['#3b82f6', '#f59e0b', '#9ca3af'], borderWidth: 0 }] },
        options: { responsive: true, plugins: { title: { display: true, text: 'Stock Units by FSN', color: chartTextColor } }, animation: { duration: 0 } }
    });
}

let saleCart = []; 

function updateCartUI() {
    const cartContainer = document.getElementById('cart-container');
    const cartList = document.getElementById('cart-list');
    const cartTotal = document.getElementById('cart-total');
    cartList.innerHTML = '';
    let totalAmount = 0;

    if (saleCart.length === 0) {
        cartContainer.classList.add('hidden');
    } else {
        cartContainer.classList.remove('hidden');
        saleCart.forEach((cartItem, index) => {
            totalAmount += cartItem.amount;
            let gstBadge = cartItem.hasGST ? `<span class="bg-indigo-100 text-indigo-700 text-[10px] px-1 rounded ml-1 font-bold">GST</span>` : '';
            cartList.innerHTML += `
                <li class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <span class="text-gray-800 dark:text-gray-200">${cartItem.item} ${gstBadge} <b class="text-primary">(x${cartItem.qty})</b></span>
                    <span class="font-bold">₹${cartItem.amount.toFixed(2)} 
                        <button type="button" onclick="window.removeCartItem(${index})" class="text-danger hover:text-red-700 ml-3 transition-colors"><i class="fa-solid fa-xmark"></i></button>
                    </span>
                </li>`;
        });
    }
    cartTotal.innerText = totalAmount.toFixed(2);
}

window.removeCartItem = function(index) {
    saleCart.splice(index, 1);
    updateCartUI();
};

document.getElementById('btn-add-to-cart').addEventListener('click', () => {
    const item = document.getElementById('sale-item').value.trim();
    const qtyStr = document.getElementById('sale-qty').value;
    const rateStr = document.getElementById('sale-rate').value;

    if (!item || !qtyStr || !rateStr) { alert("Please fill Item Name, Quantity, and Selling Rate."); return; }

    const itemExists = allInventory.find(i => i.name === item);
    if (!itemExists) { alert("Invalid Item! Please select a valid item."); return; }

    let qty = parseInt(qtyStr);
    let rate = parseFloat(rateStr);
    if (qty <= 0 || rate < 0) { alert("Please enter a valid quantity and rate."); return; }

    let amount = qty * rate;
    let hasGST = !!itemExists.hasGST;

    const existingIndex = saleCart.findIndex(c => c.item === item && c.rate === rate);
    if (existingIndex !== -1) {
        saleCart[existingIndex].qty += qty;
        saleCart[existingIndex].amount += amount;
    } else {
        saleCart.push({ item, qty, rate, amount, hasGST });
    }
    
    document.getElementById('sale-item').value = '';
    document.getElementById('sale-qty').value = '';
    document.getElementById('sale-rate').value = '';
    document.getElementById('sale-cost').value = '';
    updateCartUI();
});

const saleForm = document.getElementById('form-sale');
saleForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const submitBtn = document.getElementById('btn-save-sale');
    if (submitBtn.disabled) return;
    
    // Check pending item
    const pendingItem = document.getElementById('sale-item').value.trim();
    if (pendingItem) document.getElementById('btn-add-to-cart').click();
    if (saleCart.length === 0) { alert("No items in the cart to sell!"); return; }

    // CUSTOMER DETAILS
    let customerName = document.getElementById('sale-customer').value.trim();
    let customerGstin = document.getElementById('sale-gstin').value.trim().toUpperCase();
    if (!customerName) customerName = "Cash / Walk-in";

    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Invoice...`;
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

    try {
        const batch = writeBatch(db);
        const date = new Date().toISOString();
        
        // CREATE A MASTER INVOICE NUMBER
        const invoiceNo = "INV-" + Date.now().toString().slice(-6);

        // Save new customer if it doesn't exist
        const customerExists = allCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        if (!customerExists && customerName.toLowerCase() !== "cash" && customerName.toLowerCase() !== "cash / walk-in") {
            const newCustRef = doc(collection(db, "customers"));
            batch.set(newCustRef, {
                name: customerName,
                gstin: customerGstin,
                createdAt: date
            });
        }

        // Process Cart Items
        for (let i = 0; i < saleCart.length; i++) {
            const cartItem = saleCart[i];
            const newTransRef = doc(collection(db, "transactions"));
            const localInvItem = allInventory.find(inv => inv.name === cartItem.item);

            // Save transaction with Invoice No and Customer details
            batch.set(newTransRef, { 
                type: "Sale", 
                item: cartItem.item, 
                qty: cartItem.qty, 
                rate: cartItem.rate, 
                amount: cartItem.amount, 
                date: date, 
                hasGST: cartItem.hasGST,
                invoiceNo: invoiceNo,         // Grouping under 1 invoice
                customerName: customerName,   // Tagged customer
                customerGstin: customerGstin  // Tagged GSTIN
            });

            // Deduct stock
            if (localInvItem) {
                let newQty = Number(localInvItem.qty) - cartItem.qty;
                localInvItem.qty = newQty < 0 ? 0 : newQty; 
                batch.update(doc(db, "inventory", localInvItem.id), { qty: localInvItem.qty });
            }
        }
        await batch.commit(); 
        
        // Reset everything
        saleCart = [];
        updateCartUI();
        saleForm.reset();
        document.getElementById('sale-cost').value = '';
        document.getElementById('gst-indicator').classList.add('hidden');
        showSuccessAnimation(`Invoice ${invoiceNo} Generated Successfully!`);
        
    } catch (error) { 
        console.error(error); 
        alert("An error occurred while generating the invoice.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
});


const cosmeticForm = document.getElementById('form-cosmetic');
cosmeticForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = cosmeticForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;

    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

    const item = document.getElementById('cosmetic-item').value.trim() + " (Cosmetic)";
    let qty = parseInt(document.getElementById('cosmetic-qty').value);
    let cost = parseFloat(document.getElementById('cosmetic-cost').value);
    let rate = parseFloat(document.getElementById('cosmetic-rate').value);
    let amount = qty * rate; 
    const hasGST = document.getElementById('cosmetic-gst').checked;
    const date = new Date().toISOString();

    try {
        await addDoc(collection(db, "transactions"), { type: "Cosmetic Sale", item, qty, cost, rate, amount, date, hasGST });
        cosmeticForm.reset();
        showSuccessAnimation("Cosmetic Sale Saved!");
    } catch (e) { 
        console.error(e); alert("Error saving cosmetic sale."); 
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
});

const purchaseQtyEl = document.getElementById('purchase-qty');
const purchaseRateEl = document.getElementById('purchase-rate');
const purchaseAmtEl = document.getElementById('purchase-amount');

function calculatePurchaseAmount() {
    let q = parseFloat(purchaseQtyEl.value) || 0;
    let r = parseFloat(purchaseRateEl.value) || 0;
    purchaseAmtEl.value = (q * r).toFixed(2);
}

if(purchaseQtyEl) purchaseQtyEl.addEventListener('input', calculatePurchaseAmount);
if(purchaseRateEl) purchaseRateEl.addEventListener('input', calculatePurchaseAmount);

const purchaseForm = document.getElementById('form-purchase');
purchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-save-purchase');
    if (submitBtn.disabled) return;

    // Push pending item to cart if user forgot
    const pendingItem = document.getElementById('purchase-item').value.trim();
    if (pendingItem) document.getElementById('btn-add-purchase-cart').click();
    
    if (purchaseCart.length === 0) { alert("No items in the bill to save!"); return; }

    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving Purchase...`;
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

    // Read Master Fields
    const dateVal = document.getElementById('purchase-date').value;
    const invoiceNo = document.getElementById('purchase-invoice').value.trim().toUpperCase();
    let supplierName = document.getElementById('purchase-supplier').value.trim();
    let supplierGstin = document.getElementById('purchase-gstin').value.trim().toUpperCase();
    
    if (!supplierName) supplierName = "Cash Purchase";

    let dateObj = new Date();
    if (dateVal) {
        const parts = dateVal.split('-');
        dateObj = new Date(parts[0], parts[1]-1, parts[2]);
    }
    const dateStr = dateObj.toISOString();

    try {
        const batch = writeBatch(db);

        // Save Supplier if new
        const supplierExists = allSuppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        if (!supplierExists && supplierName.toLowerCase() !== "cash" && supplierName.toLowerCase() !== "cash purchase") {
            const newSuppRef = doc(collection(db, "suppliers"));
            batch.set(newSuppRef, { name: supplierName, gstin: supplierGstin, createdAt: dateStr });
        }

        // Process all cart items
        for (let i = 0; i < purchaseCart.length; i++) {
            const cartItem = purchaseCart[i];
            
            // 1. Create Transaction Ledger Entry
            const transRef = doc(collection(db, "transactions"));
            batch.set(transRef, { 
                type: "Purchase", 
                item: cartItem.item, 
                qty: cartItem.qty, 
                rate: cartItem.rate, 
                amount: cartItem.amount, 
                date: dateStr, 
                hasGST: cartItem.hasGST, 
                supplier: supplierName, 
                supplierGstin: supplierGstin,
                invoice: invoiceNo, 
                partNumber: cartItem.partNumber 
            });

            // 2. Update or Create Inventory
            const localInvItem = allInventory.find(inv => inv.name === cartItem.item);
            if (localInvItem) {
                batch.update(doc(db, "inventory", localInvItem.id), { 
                    qty: Number(localInvItem.qty) + cartItem.qty, 
                    hasGST: cartItem.hasGST, 
                    partNumber: cartItem.partNumber || localInvItem.partNumber 
                });
            } else {
                const newInvRef = doc(collection(db, "inventory"));
                batch.set(newInvRef, { 
                    name: cartItem.item, 
                    qty: cartItem.qty, 
                    price: cartItem.rate, // Set default sale price to purchase rate initially
                    hasGST: cartItem.hasGST, 
                    partNumber: cartItem.partNumber 
                });
            }
        }

        await batch.commit();
        
        // Reset everything
        purchaseCart = [];
        updatePurchaseCartUI();
        purchaseForm.reset();
        document.getElementById('purchase-date').value = todayStr;
        document.getElementById('purchase-gst-indicator').classList.add('hidden');
        showSuccessAnimation("Complete Purchase Saved!");

    } catch (e) { 
        console.error(e); 
        alert("Error saving complete purchase.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
});



function updateInventoryStats() {
    let totalItems = allInventory.length;
    let outCount = 0; let lowCount = 0; let totalValue = 0;
    allInventory.forEach(item => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        totalValue += (qty * price);
        if (qty === 0) outCount++;
        else if (qty <= 2) lowCount++;
    });
    document.getElementById('stat-inv-total').innerText = totalItems;
    document.getElementById('stat-inv-value').innerText = `₹${totalValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('stat-inv-out').innerText = outCount;
    document.getElementById('stat-inv-low').innerText = lowCount;
}

function renderInventoryTable() {
    let rowsHtml = [];
    const queryStr = currentInventorySearch.toLowerCase().trim();
    let filtered = allInventory.filter(item => {
        const itemName = (item.name || "").toLowerCase();
        const itemPart = (item.partNumber || "").toLowerCase();
        const qty = Number(item.qty) || 0;
        if (queryStr && !itemName.includes(queryStr) && !itemPart.includes(queryStr)) return false;
        if (currentInventoryFilter === 'out' && qty !== 0) return false;
        if (currentInventoryFilter === 'low' && (qty === 0 || qty > 2)) return false;
        return true;
    });

    filtered.forEach((item) => {
        const itemName = item.name || "Unknown";
        const itemPart = item.partNumber ? `<span class="text-[10px] text-gray-400 block -mt-1">PN: ${item.partNumber}</span>` : '';
        const itemQty = Number(item.qty) || 0;
        const itemPrice = Number(item.price) || 0;
        const stockValue = itemQty * itemPrice;

        let badgeHtml = "";
        if (itemQty === 0) badgeHtml = `<span class="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full whitespace-nowrap">Out of stock</span>`;
        else if (itemQty <= 2) badgeHtml = `<span class="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full whitespace-nowrap">Low &mdash; ${itemQty} left</span>`;
        else badgeHtml = `<span class="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full whitespace-nowrap">${itemQty} in stock</span>`;

        let gstBadge = item.hasGST ? `<span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold uppercase">GST</span>` : '';

        rowsHtml.push(`
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <td class="px-5 py-4">
                <div class="font-medium text-gray-900 dark:text-white flex items-center">${itemName} ${gstBadge}</div>
                ${itemPart}
            </td>
            <td class="px-5 py-4 text-right text-gray-900 dark:text-gray-100 font-medium">${itemQty}</td>
            <td class="px-5 py-4 text-right text-gray-900 dark:text-gray-100">₹${itemPrice.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td class="px-5 py-4 text-right text-gray-600 dark:text-gray-400 font-medium">₹${stockValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td class="px-5 py-4 text-right">${badgeHtml}</td>
            <td class="px-5 py-4 text-right">
                <div class="flex justify-end gap-2">
                    <button class="btn-edit w-8 h-8 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary dark:hover:text-primary transition-colors" data-id="${item.id}" data-name="${itemName}" data-qty="${itemQty}" data-price="${itemPrice}" data-gst="${item.hasGST ? 'true' : ''}" data-part="${item.partNumber || ''}" title="Edit">
                        <i class="fa-solid fa-pen pointer-events-none text-xs"></i>
                    </button>
                    <button class="btn-delete w-8 h-8 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-danger hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:border-red-800 transition-colors" data-id="${item.id}" title="Delete">
                        <i class="fa-solid fa-xmark pointer-events-none"></i>
                    </button>
                </div>
            </td>
        </tr>`);
    });

    if (filtered.length === 0) rowsHtml.push(`<tr><td colspan="6" class="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No items found.</td></tr>`);
    document.querySelector('#table-inventory tbody').innerHTML = rowsHtml.join('');
}

document.getElementById('search-inventory').addEventListener('input', (e) => {
    currentInventorySearch = e.target.value;
    renderInventoryTable();
});

document.querySelectorAll('.inv-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.inv-tab').forEach(t => {
            t.classList.remove('active', 'bg-white', 'dark:bg-gray-600', 'text-primary', 'shadow-sm', 'border-gray-200', 'dark:border-gray-500');
            t.classList.add('text-gray-500', 'dark:text-gray-400', 'border-transparent');
        });
        const activeBtn = e.target;
        activeBtn.classList.remove('text-gray-500', 'dark:text-gray-400', 'border-transparent');
        activeBtn.classList.add('active', 'bg-white', 'dark:bg-gray-600', 'text-primary', 'shadow-sm', 'border-gray-200', 'dark:border-gray-500');
        currentInventoryFilter = activeBtn.getAttribute('data-filter');
        renderInventoryTable();
    });
});

const inventoryForm = document.getElementById('form-inventory');
inventoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('inv-name').value.trim();
    const partNumber = document.getElementById('inv-part').value.trim();
    let qty = parseInt(document.getElementById('inv-qty').value); 
    let price = parseFloat(document.getElementById('inv-price').value);
    const hasGST = document.getElementById('inv-gst').checked;
    
    if (isNaN(qty)) qty = 0; 
    if (isNaN(price)) price = 0;
    
    const editId = inventoryForm.getAttribute('data-edit-id'); 
    if (editId) { 
        await updateDoc(doc(db, "inventory", editId), { name, qty, price, hasGST, partNumber }); 
        resetInventoryForm(); 
        showSuccessAnimation("Item Updated!");
    } else { 
        await addDoc(collection(db, "inventory"), { name, qty, price, hasGST, partNumber }); 
        inventoryForm.reset(); 
        showSuccessAnimation("Item Added to Stock!");
    }
});

document.getElementById('btn-inv-cancel').addEventListener('click', resetInventoryForm);

function resetInventoryForm() {
    inventoryForm.reset(); 
    inventoryForm.removeAttribute('data-edit-id');
    document.getElementById('btn-inv-submit').innerText = "Save";
    document.getElementById('inv-form-title').innerText = "Add new item";
    document.getElementById('btn-inv-cancel').style.display = "none";
}

document.querySelector('#table-inventory tbody').addEventListener('click', async (e) => {
    const btnDel = e.target.closest('.btn-delete');
    if (btnDel) {
        if (confirm("Delete this item?")) {
            await deleteDoc(doc(db, "inventory", btnDel.getAttribute('data-id')));
        }
    }
    const btnEdit = e.target.closest('.btn-edit');
    if (btnEdit) {
        document.getElementById('inv-name').value = btnEdit.getAttribute('data-name');
        document.getElementById('inv-qty').value = btnEdit.getAttribute('data-qty');
        document.getElementById('inv-price').value = btnEdit.getAttribute('data-price');
        document.getElementById('inv-gst').checked = !!btnEdit.getAttribute('data-gst');
        document.getElementById('inv-part').value = btnEdit.getAttribute('data-part') || '';
        inventoryForm.setAttribute('data-edit-id', btnEdit.getAttribute('data-id'));
        document.getElementById('btn-inv-submit').innerText = "Update";
        document.getElementById('inv-form-title').innerText = `Edit item`;
        document.getElementById('btn-inv-cancel').style.display = "inline-block";
        document.getElementById('inv-name').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

document.getElementById('btn-trigger-excel').addEventListener('click', () => { document.getElementById('excel-file').click(); });

document.getElementById('excel-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(!confirm("WARNING: This will DELETE all current inventory and replace it entirely with the data from the Excel file. Are you absolutely sure?")) { e.target.value = ''; return; }

    const btn = document.getElementById('btn-trigger-excel');
    const ogText = btn.innerHTML; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-2xl"></i> <span class="text-sm">Importing...</span>`; btn.disabled = true;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);

            for (let item of allInventory) { await deleteDoc(doc(db, "inventory", item.id)); }

            for(const row of json) {
                const name = row['particulars'] || row['Particulars'] || row['Name'] || row['name'];
                const qtyStr = row['quantity'] || row['Quantity'] || row['qty'];
                const rateStr = row['rate'] || row['Rate'] || row['price'];
                const partStr = row['part'] || row['Part Number'] || row['PN'];
                const gstVal = row['gst'] || row['GST'];

                if(name && name.trim() !== '') {
                    const qty = Number(qtyStr) || 0;
                    const price = Number(rateStr) || 0;
                    const hasGST = (String(gstVal).toLowerCase() === 'yes' || String(gstVal).toLowerCase() === 'true');
                    const partNumber = partStr ? String(partStr).trim() : '';
                    await addDoc(collection(db, "inventory"), { name: name.trim(), qty, price, hasGST, partNumber });
                }
            }
            showSuccessAnimation("Excel Successfully Imported!");
        } catch (error) {
            console.error(error); alert("An error occurred during import.");
        } finally {
            btn.innerHTML = ogText; btn.disabled = false; document.getElementById('excel-file').value = ''; 
        }
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('btn-sync-drive').addEventListener('click', () => { alert("Sync to Google Drive initiated."); });

document.getElementById('btn-merge-dup').addEventListener('click', async () => {
    if(!confirm("Are you sure you want to scan and merge identical items?")) return;
    const btn = document.getElementById('btn-merge-dup');
    const ogText = btn.innerHTML; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-2xl"></i> <span class="text-sm">Merging...</span>`; btn.disabled = true;

    try {
        const itemsMap = {};
        allInventory.forEach(item => {
            const key = item.name.trim().toLowerCase(); 
            if(!itemsMap[key]) itemsMap[key] = [];
            itemsMap[key].push(item);
        });

        let mergeCount = 0;
        for(const key in itemsMap) {
            if(itemsMap[key].length > 1) {
                mergeCount++;
                let totalQty = 0; let totalPriceObj = 0; let hasGST = false;
                let mainId = itemsMap[key][0].id;
                let finalPartNumber = itemsMap[key][0].partNumber || '';
                
                itemsMap[key].forEach(i => {
                    let iQty = Number(i.qty) || 0; let iPrice = Number(i.price) || 0;
                    totalQty += iQty; totalPriceObj += (iQty * iPrice);
                    if (i.hasGST) hasGST = true;
                    if (!finalPartNumber && i.partNumber) finalPartNumber = i.partNumber;
                });
                let avgPrice = totalQty > 0 ? (totalPriceObj / totalQty) : 0;
                await updateDoc(doc(db, "inventory", mainId), { qty: totalQty, price: avgPrice, hasGST: hasGST, partNumber: finalPartNumber });
                
                for(let i = 1; i < itemsMap[key].length; i++) {
                    await deleteDoc(doc(db, "inventory", itemsMap[key][i].id));
                }
            }
        }
        if(mergeCount > 0) showSuccessAnimation(`Merged ${mergeCount} Duplicate Groups!`);
        else alert("No duplicates found.");
    } catch (err) { 
        console.error(err); alert("An error occurred during merge.");
    } finally { btn.innerHTML = ogText; btn.disabled = false; }
});



function setupCustomerSearch() {
    const custInput = document.getElementById('sale-customer');
    const gstinInput = document.getElementById('sale-gstin');
    const dropdownEl = document.getElementById('sale-customer-dropdown');
    const gstIndicator = document.getElementById('gst-indicator');


    gstinInput.addEventListener('input', () => {
        if(gstinInput.value.trim().length > 0) {
            gstIndicator.classList.remove('hidden');
        } else {
            gstIndicator.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!custInput.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.classList.add('hidden');
        }
    });

    custInput.addEventListener('focus', renderCustDropdown);
    custInput.addEventListener('input', () => {
        renderCustDropdown();
        // If they type cash, clear GST
        if(custInput.value.trim().toLowerCase() === 'cash') {
            gstinInput.value = '';
            gstIndicator.classList.add('hidden');
        }
    });

    function renderCustDropdown() {
        const queryStr = custInput.value.toLowerCase().trim();
        let filtered = allCustomers;
        
        if (queryStr) {
            filtered = allCustomers.filter(c => 
                (c.name && c.name.toLowerCase().includes(queryStr)) || 
                (c.gstin && c.gstin.toLowerCase().includes(queryStr))
            );
        }

        let html = '';
        if (filtered.length === 0) {
            if(queryStr && queryStr !== 'cash') {
                html = `<div class="px-4 py-3 bg-indigo-50 text-indigo-700 cursor-pointer font-semibold text-sm hover:bg-indigo-600 hover:text-white transition-colors cust-dropdown-item" data-name="${custInput.value}" data-gstin="">
                    <i class="fa-solid fa-plus mr-2"></i> Add new Customer/Shop: "${custInput.value}"
                </div>`;
            } else {
                html = `<div class="p-3 text-sm text-gray-500 text-center">No matching shops found.</div>`;
            }
        } else {
            html += `<div class="px-3 py-1.5 bg-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Saved Shops</div>`;
            filtered.forEach(c => {
                let gstinText = c.gstin ? `GSTIN: ${c.gstin}` : `No GSTIN`;
                let icon = c.gstin ? `<i class="fa-solid fa-file-invoice-dollar text-indigo-500"></i>` : `<i class="fa-solid fa-user text-gray-400"></i>`;
                html += `
                <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600/50 cursor-pointer flex justify-between items-center cust-dropdown-item border-b border-gray-100" data-name="${c.name}" data-gstin="${c.gstin || ''}">
                    <div class="flex items-center gap-3">
                        ${icon}
                        <div class="flex flex-col">
                            <span class="font-semibold text-sm text-gray-800 dark:text-gray-100">${c.name}</span>
                            <span class="text-[10px] text-gray-500">${gstinText}</span>
                        </div>
                    </div>
                </div>`;
            });
        }
        
        dropdownEl.innerHTML = html;
        dropdownEl.classList.remove('hidden');

        // Attach click events
        dropdownEl.querySelectorAll('.cust-dropdown-item').forEach(el => {
            el.addEventListener('click', () => {
                custInput.value = el.getAttribute('data-name');
                gstinInput.value = el.getAttribute('data-gstin');
                dropdownEl.classList.add('hidden');
                
                // Trigger the GST badge check
                gstinInput.dispatchEvent(new Event('input'));
            });
        });
    }
}



// --- PURCHASE SUPPLIER SEARCH LOGIC ---
function setupSupplierSearch() {
    const suppInput = document.getElementById('purchase-supplier');
    const gstinInput = document.getElementById('purchase-gstin');
    const dropdownEl = document.getElementById('purchase-supplier-dropdown');
    const gstIndicator = document.getElementById('purchase-gst-indicator');

    gstinInput.addEventListener('input', () => {
        if(gstinInput.value.trim().length > 0) gstIndicator.classList.remove('hidden');
        else gstIndicator.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!suppInput.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.classList.add('hidden');
        }
    });

    suppInput.addEventListener('focus', renderSuppDropdown);
    suppInput.addEventListener('input', () => {
        renderSuppDropdown();
        if(suppInput.value.trim().toLowerCase() === 'cash') {
            gstinInput.value = '';
            gstIndicator.classList.add('hidden');
        }
    });

    function renderSuppDropdown() {
        const queryStr = suppInput.value.toLowerCase().trim();
        let filtered = allSuppliers;
        
        if (queryStr) {
            filtered = allSuppliers.filter(s => 
                (s.name && s.name.toLowerCase().includes(queryStr)) || 
                (s.gstin && s.gstin.toLowerCase().includes(queryStr))
            );
        }

        let html = '';
        if (filtered.length === 0) {
            if(queryStr && queryStr !== 'cash') {
                html = `<div class="px-4 py-3 bg-red-50 text-red-700 cursor-pointer font-semibold text-sm hover:bg-red-600 hover:text-white transition-colors supp-dropdown-item" data-name="${suppInput.value}" data-gstin="">
                    <i class="fa-solid fa-plus mr-2"></i> Add new Supplier: "${suppInput.value}"
                </div>`;
            } else {
                html = `<div class="p-3 text-sm text-gray-500 text-center">No matching suppliers found.</div>`;
            }
        } else {
            html += `<div class="px-3 py-1.5 bg-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Saved Suppliers</div>`;
            filtered.forEach(s => {
                let gstinText = s.gstin ? `GSTIN: ${s.gstin}` : `No GSTIN`;
                let icon = s.gstin ? `<i class="fa-solid fa-file-invoice-dollar text-danger"></i>` : `<i class="fa-solid fa-truck text-gray-400"></i>`;
                html += `
                <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600/50 cursor-pointer flex justify-between items-center supp-dropdown-item border-b border-gray-100" data-name="${s.name}" data-gstin="${s.gstin || ''}">
                    <div class="flex items-center gap-3">
                        ${icon}
                        <div class="flex flex-col">
                            <span class="font-semibold text-sm text-gray-800 dark:text-gray-100">${s.name}</span>
                            <span class="text-[10px] text-gray-500">${gstinText}</span>
                        </div>
                    </div>
                </div>`;
            });
        }
        
        dropdownEl.innerHTML = html;
        dropdownEl.classList.remove('hidden');

        dropdownEl.querySelectorAll('.supp-dropdown-item').forEach(el => {
            el.addEventListener('click', () => {
                suppInput.value = el.getAttribute('data-name');
                gstinInput.value = el.getAttribute('data-gstin');
                dropdownEl.classList.add('hidden');
                gstinInput.dispatchEvent(new Event('input'));
            });
        });
    }
}

// --- PURCHASE CART LOGIC ---
function updatePurchaseCartUI() {
    const cartContainer = document.getElementById('purchase-cart-container');
    const cartList = document.getElementById('purchase-cart-list');
    const cartTotal = document.getElementById('purchase-cart-total');
    cartList.innerHTML = '';
    let totalAmount = 0;

    if (purchaseCart.length === 0) {
        cartContainer.classList.add('hidden');
    } else {
        cartContainer.classList.remove('hidden');
        purchaseCart.forEach((item, index) => {
            totalAmount += item.amount;
            let gstBadge = item.hasGST ? `<span class="bg-red-100 text-red-700 text-[10px] px-1 rounded ml-1 font-bold">GST</span>` : '';
            let partText = item.partNumber ? `<span class="text-xs text-gray-400 ml-2">PN: ${item.partNumber}</span>` : '';
            
            cartList.innerHTML += `
                <li class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <div class="flex flex-col">
                        <span class="text-gray-800 dark:text-gray-200">${item.item} ${gstBadge} <b class="text-danger">(x${item.qty})</b></span>
                        ${partText}
                    </div>
                    <span class="font-bold">₹${item.amount.toFixed(2)} 
                        <button type="button" onclick="window.removePurchaseItem(${index})" class="text-danger hover:text-red-700 ml-3"><i class="fa-solid fa-xmark"></i></button>
                    </span>
                </li>`;
        });
    }
    cartTotal.innerText = totalAmount.toFixed(2);
}

window.removePurchaseItem = function(index) {
    purchaseCart.splice(index, 1);
    updatePurchaseCartUI();
};

document.getElementById('btn-add-purchase-cart').addEventListener('click', () => {
    const item = document.getElementById('purchase-item').value.trim();
    const partNumber = document.getElementById('purchase-part').value.trim();
    const qtyStr = document.getElementById('purchase-qty').value;
    const rateStr = document.getElementById('purchase-rate').value;
    const hasGST = document.getElementById('purchase-gst').checked;

    if (!item || !qtyStr || !rateStr) { alert("Please fill Item Name, Qty, and Rate."); return; }

    let qty = parseInt(qtyStr);
    let rate = parseFloat(rateStr);
    if (qty <= 0 || rate < 0) { alert("Valid quantity and rate required."); return; }

    let amount = qty * rate;

    // Check if it exists in cart to merge, otherwise push new
    const existingIndex = purchaseCart.findIndex(c => c.item === item && c.rate === rate);
    if (existingIndex !== -1) {
        purchaseCart[existingIndex].qty += qty;
        purchaseCart[existingIndex].amount += amount;
    } else {
        purchaseCart.push({ item, partNumber, qty, rate, amount, hasGST });
    }
    
    // Clear item fields
    document.getElementById('purchase-item').value = '';
    document.getElementById('purchase-part').value = '';
    document.getElementById('purchase-qty').value = '';
    document.getElementById('purchase-rate').value = '';
    document.getElementById('purchase-amount').value = '';
    document.getElementById('purchase-gst').checked = false;
    
    updatePurchaseCartUI();
});
