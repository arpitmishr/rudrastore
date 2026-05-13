import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, writeBatch, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
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

// ==========================================
// 2. GLOBAL VARIABLES
// ==========================================
let unsubInventory = null;
let unsubTransactions = null;
let unsubCustomers = null;
let unsubSuppliers = null;

let allTransactions = [];
let allInventory = [];
let allCustomers = [];
let allSuppliers =[];

window.saleCart = [];
window.purRows = []; // ERP Table rows state

let myChartMonthly = null;
let myChartABC = null;
let myChartFSN = null;

let currentInventorySearch = "";
let currentInventoryFilter = "all";
let globalYearFilter = "All";

let lastMonthlyData = {};
let lastAbcTotals = {};
let lastFsnTotals = {};

// ==========================================
// 3. INITIAL SETUP & UTILS
// ==========================================
const todayStr = new Date().toISOString().split('T')[0];
if(document.getElementById('filter-trans-start')) document.getElementById('filter-trans-start').value = todayStr;
if(document.getElementById('filter-trans-end')) document.getElementById('filter-trans-end').value = todayStr;
if(document.getElementById('pur-date')) document.getElementById('pur-date').value = todayStr;

function showSuccessAnimation(msg = "Success!") {
    const overlay = document.getElementById('success-overlay');
    const card = document.getElementById('success-card');
    const iconContainer = document.getElementById('success-icon-container');
    
    if(!overlay || !card || !iconContainer) return;

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

function isYearMatch(dateStr) {
    if (globalYearFilter === "All") return true;
    if (!dateStr) return false;
    return new Date(dateStr).getFullYear().toString() === globalYearFilter;
}

function updateYearDropdown(transactions) {
    const selectEl = document.getElementById('global-year-filter');
    if(!selectEl) return;
    const currentVal = selectEl.value;
    const years = new Set();
    transactions.forEach(t => {
        if(t.date) years.add(new Date(t.date).getFullYear().toString());
    });
    let html = `<option value="All">All Years</option>`;
    Array.from(years).sort((a,b) => b - a).forEach(year => { html += `<option value="${year}">${year}</option>`; });
    selectEl.innerHTML = html;
    if (years.has(currentVal) || currentVal === "All") selectEl.value = currentVal;
    else { globalYearFilter = "All"; selectEl.value = "All"; }
}

const btnThemeToggle = document.getElementById('btn-theme-toggle');
if (btnThemeToggle) {
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
}

// ==========================================
// 4. AUTHENTICATION & TABS
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        startDatabaseListeners();
        setupPredictiveSearch('sale-item', 'sale-item-dropdown', true);
        setupCustomerSearch();
        setupSupplierSearch(); 
        initPurchaseTable(); 
    } else {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        stopDatabaseListeners();
    }
});

const formLogin = document.getElementById('form-login');
if(formLogin) {
    formLogin.addEventListener('submit', async (e) => {
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
}

const btnLogout = document.getElementById('btn-logout');
if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

const tabs =['dashboard', 'transactions', 'analytics', 'sales', 'purchases', 'inventory', 'settings'];
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

const globalYearEl = document.getElementById('global-year-filter');
if(globalYearEl) {
    globalYearEl.addEventListener('change', (e) => {
        globalYearFilter = e.target.value;
        if (document.getElementById('dash-year-label')) {
            document.getElementById('dash-year-label').innerText = `(${globalYearFilter === 'All' ? 'All Years' : globalYearFilter})`;
        }
        updateDashboardMetrics();
        renderTransactionsTable();
        renderDashboardTopItems();
        if (document.getElementById('tab-analytics').classList.contains('active')) runAnalytics();
    });
}

// ==========================================
// 5. DATABASE LISTENERS
// ==========================================
function startDatabaseListeners() {
    unsubCustomers = onSnapshot(collection(db, "customers"), (snapshot) => {
        allCustomers =[];
        snapshot.forEach((doc) => { const c = doc.data(); c.id = doc.id; allCustomers.push(c); });
    });

    unsubSuppliers = onSnapshot(collection(db, "suppliers"), (snapshot) => {
        allSuppliers =[];
        snapshot.forEach((doc) => { const s = doc.data(); s.id = doc.id; allSuppliers.push(s); });
    });

    unsubInventory = onSnapshot(collection(db, "inventory"), (snapshot) => {
        allInventory =[];
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            item.id = docSnap.id;
            allInventory.push(item);
        });
        updateInventoryStats();
        renderInventoryTable();
        if (document.getElementById('tab-analytics')?.classList.contains('active')) runAnalytics();
        updateDashboardMetrics();
    });

    unsubTransactions = onSnapshot(query(collection(db, "transactions"), orderBy("date", "desc")), (snapshot) => {
        allTransactions =[];
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
        if (document.getElementById('tab-analytics')?.classList.contains('active')) runAnalytics();
    });
}

function stopDatabaseListeners() {
    if (unsubInventory) unsubInventory();
    if (unsubTransactions) unsubTransactions();
    if (unsubCustomers) unsubCustomers(); 
    if (unsubSuppliers) unsubSuppliers();
}

// ==========================================
// 6. GST AUTO-CALCULATION LOGIC (Sales)
// ==========================================
function attachSaleTaxLogic() {
    const qtyEl = document.getElementById(`sale-qty`);
    const rateEl = document.getElementById(`sale-rate`);
    const gstCheck = document.getElementById(`sale-gst`);
    const taxSec = document.getElementById(`sale-tax-section`);
    const taxableEl = document.getElementById(`sale-taxable`);
    const gstRate = document.getElementById(`sale-gst-rate`);
    const cgstEl = document.getElementById(`sale-cgst`);
    const sgstEl = document.getElementById(`sale-sgst`);
    const igstEl = document.getElementById(`sale-igst`);
    const amtEl = document.getElementById(`sale-amount`);

    function recalc() {
        let q = parseFloat(qtyEl?.value) || 0;
        let r = parseFloat(rateEl?.value) || 0;
        let taxVal = q * r;
        
        if(taxableEl) taxableEl.value = taxVal.toFixed(2);

        let c = 0, s = 0, i = 0;
        
        if(gstCheck?.checked) {
            taxSec?.classList.remove('hidden');
            c = parseFloat(cgstEl?.value) || 0;
            s = parseFloat(sgstEl?.value) || 0;
            i = parseFloat(igstEl?.value) || 0;
        } else {
            taxSec?.classList.add('hidden');
            if(cgstEl) cgstEl.value = '0.00';
            if(sgstEl) sgstEl.value = '0.00';
            if(igstEl) igstEl.value = '0.00';
        }
        
        if(amtEl) amtEl.value = (taxVal + c + s + i).toFixed(2);
    }

    [qtyEl, rateEl, gstCheck, gstRate].forEach(el => {
        if(!el) return;
        el.addEventListener('input', () => {
            let taxVal = (parseFloat(qtyEl?.value) || 0) * (parseFloat(rateEl?.value) || 0);
            
            if(gstCheck?.checked) {
                let rateVal = parseFloat(gstRate?.value) || 18;
                let taxAmt = taxVal * (rateVal / 100);
                if(cgstEl) cgstEl.value = (taxAmt / 2).toFixed(2);
                if(sgstEl) sgstEl.value = (taxAmt / 2).toFixed(2);
                if(igstEl) igstEl.value = '0.00';
            }
            recalc();
        });
    });
    [cgstEl, sgstEl, igstEl].forEach(el => {
        if(el) el.addEventListener('input', recalc);
    });
}
attachSaleTaxLogic();

// ==========================================
// 7. PREDICTIVE SEARCHES (Inventory / Sales)
// ==========================================
function setupPredictiveSearch(inputId, dropdownId, isSale) {
    const inputEl = document.getElementById(inputId);
    const dropdownEl = document.getElementById(dropdownId);
    
    if (!inputEl || !dropdownEl) return;

    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.classList.add('hidden');
        }
    });

    inputEl.addEventListener('focus', renderDropdown);
    inputEl.addEventListener('input', renderDropdown);

    function renderDropdown() {
        const queryStr = String(inputEl.value).toLowerCase().trim();
        let filtered = allInventory;
        
        if (queryStr) {
            filtered = allInventory.filter(item => String(item.name || "").toLowerCase().includes(queryStr));
        }

        let html = '';
        if (filtered.length === 0) {
            html = `<div class="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">No inventory items found.</div>`;
            dropdownEl.innerHTML = html;
            dropdownEl.classList.remove('hidden');
            return;
        }

        const grouped = { "🟢 In Stock":[], "🟠 Low Stock": [], "🔴 Out of Stock":[] };
        filtered.forEach(item => {
            const qty = Number(item.qty) || 0;
            if (qty === 0) grouped["🔴 Out of Stock"].push(item);
            else if (qty <= 3) grouped["🟠 Low Stock"].push(item);
            else grouped["🟢 In Stock"].push(item);
        });

        for (const[category, items] of Object.entries(grouped)) {
            if (items.length > 0) {
                html += `<div class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700/80 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10 border-y border-gray-200 dark:border-gray-600">${category}</div>`;
                items.forEach(item => {
                    const priceStr = Number(item.price || 0).toFixed(2);
                    const qtyStr = Number(item.qty || 0);
                    const gstAttr = item.hasGST ? 'true' : '';
                    const hsnAttr = item.hsn || '';
                    const safeName = item.name || "Unknown Item";
                    
                    html += `
                    <div class="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600/50 cursor-pointer flex justify-between items-center dropdown-item border-b border-gray-50 dark:border-gray-700 dark:last:border-0 transition-colors" data-name="${safeName}" data-price="${item.price || 0}" data-gst="${gstAttr}" data-hsn="${hsnAttr}">
                        <div class="flex flex-col">
                            <span class="font-semibold text-sm text-gray-800 dark:text-gray-100">${safeName}</span>
                            <div class="flex gap-2">
                                ${hsnAttr ? `<span class="text-[10px] text-indigo-400">HSN: ${hsnAttr}</span>` : ''}
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="block text-xs text-gray-500 dark:text-gray-400">Stock: ${qtyStr}</span>
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
                
                const hsnEl = document.getElementById(`sale-hsn`);
                if(hsnEl) hsnEl.value = el.getAttribute('data-hsn');
                
                const rateEl = document.getElementById('sale-rate');
                if (rateEl) {
                    rateEl.value = el.getAttribute('data-price');
                    rateEl.dispatchEvent(new Event('input')); 
                }

                const gstEl = document.getElementById(`sale-gst`);
                if(gstEl) {
                    gstEl.checked = !!el.getAttribute('data-gst');
                    gstEl.dispatchEvent(new Event('input')); 
                }
            });
        });
    }
}

// ==========================================
// 8. MASTER SEARCHES (Customer & Supplier)
// ==========================================
function setupCustomerSearch() {
    const custInput = document.getElementById('sale-customer');
    const gstinInput = document.getElementById('sale-gstin');
    const dropdownEl = document.getElementById('sale-customer-dropdown');
    const gstIndicator = document.getElementById('gst-indicator');

    if(!custInput || !gstinInput) return;

    gstinInput.addEventListener('input', () => {
        if(gstinInput.value.trim().length > 0) gstIndicator.classList.remove('hidden');
        else gstIndicator.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!custInput.contains(e.target) && !dropdownEl.contains(e.target)) dropdownEl.classList.add('hidden');
    });

    custInput.addEventListener('focus', renderCustDropdown);
    custInput.addEventListener('input', () => {
        renderCustDropdown();
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
                    <i class="fa-solid fa-plus mr-2"></i> Add new Customer: "${custInput.value}"
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
                <div class="px-4 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center cust-dropdown-item border-b border-gray-100" data-name="${c.name}" data-gstin="${c.gstin || ''}">
                    <div class="flex items-center gap-3">
                        ${icon}
                        <div class="flex flex-col">
                            <span class="font-semibold text-sm text-gray-800">${c.name}</span>
                            <span class="text-[10px] text-gray-500">${gstinText}</span>
                        </div>
                    </div>
                </div>`;
            });
        }
        
        dropdownEl.innerHTML = html;
        dropdownEl.classList.remove('hidden');

        dropdownEl.querySelectorAll('.cust-dropdown-item').forEach(el => {
            el.addEventListener('click', () => {
                custInput.value = el.getAttribute('data-name');
                gstinInput.value = el.getAttribute('data-gstin');
                dropdownEl.classList.add('hidden');
                gstinInput.dispatchEvent(new Event('input'));
            });
        });
    }
}

function setupSupplierSearch() {
    const suppInput = document.getElementById('pur-supplier');
    const gstinInput = document.getElementById('pur-gstin');
    const dropdownEl = document.getElementById('pur-supplier-dropdown');
    const badgeEl = document.getElementById('pur-supply-badge');

    if(!suppInput || !dropdownEl) return;

    if(gstinInput) {
        gstinInput.addEventListener('input', () => {
            if(gstinInput.value.trim().length > 0) {
                badgeEl?.classList.remove('hidden');
                if(badgeEl) badgeEl.innerText = "Registered Supply";
            } else {
                badgeEl?.classList.add('hidden');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!suppInput.contains(e.target) && !dropdownEl.contains(e.target)) dropdownEl.classList.add('hidden');
    });

    suppInput.addEventListener('focus', renderSuppDropdown);
    suppInput.addEventListener('input', () => {
        renderSuppDropdown();
        if(suppInput.value.trim().toLowerCase() === 'cash') {
            if(gstinInput) gstinInput.value = '';
            badgeEl?.classList.add('hidden');
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
            html += `<div class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saved Suppliers</div>`;
            filtered.forEach(s => {
                let gstinText = s.gstin ? `GSTIN: ${s.gstin}` : `No GSTIN`;
                let icon = s.gstin ? `<i class="fa-solid fa-file-invoice-dollar text-danger"></i>` : `<i class="fa-solid fa-truck text-gray-400"></i>`;
                html += `
                <div class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer flex justify-between items-center supp-dropdown-item border-b border-gray-100 dark:border-gray-700" data-name="${s.name}" data-gstin="${s.gstin || ''}">
                    <div class="flex items-center gap-3">
                        ${icon}
                        <div class="flex flex-col">
                            <span class="font-semibold text-sm text-gray-800 dark:text-gray-200">${s.name}</span>
                            <span class="text-[10px] text-gray-500 dark:text-gray-400">${gstinText}</span>
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
                if(gstinInput) gstinInput.value = el.getAttribute('data-gstin');
                dropdownEl.classList.add('hidden');
                if(gstinInput) gstinInput.dispatchEvent(new Event('input'));
            });
        });
    }
}

// ==========================================
// 9. CART UIS & ADD ITEMS (Sales Only)
// ==========================================
function updateCartUI() {
    const cartContainer = document.getElementById('cart-container');
    const cartList = document.getElementById('cart-list');
    const cartTotal = document.getElementById('cart-total');
    if(!cartContainer || !cartList) return;

    cartList.innerHTML = '';
    let totalAmount = 0;

    if (!window.saleCart || window.saleCart.length === 0) {
        cartContainer.classList.add('hidden');
    } else {
        cartContainer.classList.remove('hidden');
        window.saleCart.forEach((item, index) => {
            totalAmount += item.amount;
            let gstBadge = item.hasGST ? `<span class="bg-indigo-100 text-indigo-700 text-[10px] px-1 rounded ml-1 font-bold">GST</span>` : '';
            let taxDetails = item.hasGST ? `<span class="text-[10px] text-gray-400 block mt-0.5">HSN: ${item.hsn||'N/A'} | Taxable: ₹${Number(item.taxable||0).toFixed(2)} | Tax: ₹${Number(item.cgst+item.sgst+item.igst).toFixed(2)}</span>` : '';
            
            cartList.innerHTML += `
                <li class="py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-800 dark:text-gray-200">${item.item} ${gstBadge} <b class="text-primary">(x${item.qty})</b></span>
                        <span class="font-bold">₹${Number(item.amount||0).toFixed(2)} 
                            <button type="button" onclick="window.removeCartItem(${index})" class="text-danger hover:text-red-700 ml-3 transition-colors"><i class="fa-solid fa-xmark"></i></button>
                        </span>
                    </div>
                    ${taxDetails}
                </li>`;
        });
    }
    if(cartTotal) cartTotal.innerText = totalAmount.toFixed(2);
}

window.removeCartItem = function(index) {
    window.saleCart.splice(index, 1);
    updateCartUI();
};

const btnAddToCart = document.getElementById('btn-add-to-cart');
if(btnAddToCart) {
    btnAddToCart.addEventListener('click', () => {
        const item = document.getElementById('sale-item').value.trim();
        const qty = parseInt(document.getElementById('sale-qty').value);
        const rate = parseFloat(document.getElementById('sale-rate').value);
        const hasGST = document.getElementById('sale-gst').checked;
        const hsn = document.getElementById('sale-hsn').value.trim();
        
        let taxable = parseFloat(document.getElementById('sale-taxable').value) || (qty * rate);
        let cgst = parseFloat(document.getElementById('sale-cgst').value) || 0;
        let sgst = parseFloat(document.getElementById('sale-sgst').value) || 0;
        let igst = parseFloat(document.getElementById('sale-igst').value) || 0;
        let amount = parseFloat(document.getElementById('sale-amount').value) || (taxable + cgst + sgst + igst);

        if (!item || isNaN(qty) || isNaN(rate) || qty <= 0) { 
            alert("Please fill Item Name, valid Qty, and Rate."); 
            return; 
        }
        
        window.saleCart.push({ item, qty, rate, amount, hasGST, hsn, taxable, cgst, sgst, igst });
        
        document.getElementById('sale-item').value = ''; 
        document.getElementById('sale-qty').value = ''; 
        document.getElementById('sale-rate').value = '';
        document.getElementById('sale-hsn').value = ''; 
        document.getElementById('sale-gst').checked = false; 
        document.getElementById('sale-gst').dispatchEvent(new Event('input'));
        
        updateCartUI();
    });
}

// ==========================================
// 10. NEW ERP PURCHASE TABLE LOGIC
// ==========================================
function initPurchaseTable() {
    const tbody = document.getElementById('pur-tbody');
    const gstMaster = document.getElementById('pur-gst-master');
    const btnSave = document.getElementById('btn-pur-save');
    const btnSavePrint = document.getElementById('btn-pur-saveprint');
    const btnReset = document.getElementById('btn-pur-reset');
    const overrideMathToggle = document.getElementById('pur-manual-override');

    if(!tbody) return;

    // Initialize with 1 empty row
    window.purRows = [{ id: Date.now(), item: '', hsn: '', qty: '', unit: 'Pcs', rate: '', gst: 18, taxable: 0, taxAmt: 0, total: 0 }];
    
    // Global Toggles
    if(gstMaster) {
        gstMaster.addEventListener('change', () => {
            renderPurchaseTable(); 
            calcPurchaseTotals();
        });
    }

    if (overrideMathToggle) {
        overrideMathToggle.addEventListener('change', calcPurchaseTotals);
    }

    // Keyboard Shortcuts for table navigation
    tbody.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addPurchaseRow();
            return;
        }
        
        if(e.key === 'Enter' && !e.ctrlKey) {
            e.preventDefault();
            const inputs = Array.from(tbody.querySelectorAll('.erp-input:not([readonly])'));
            const index = inputs.indexOf(e.target);
            if(index > -1) {
                if(e.shiftKey && index > 0) inputs[index-1].focus();
                else if(!e.shiftKey && index < inputs.length - 1) inputs[index+1].focus();
                else if(!e.shiftKey && index === inputs.length - 1) addPurchaseRow();
            }
        }
    });

    if(btnReset) {
        btnReset.addEventListener('click', () => {
            if(confirm("Clear all purchase data?")) {
                window.purRows = [{ id: Date.now(), item: '', hsn: '', qty: '', unit: 'Pcs', rate: '', gst: 18, taxable: 0, taxAmt: 0, total: 0 }];
                document.getElementById('pur-supplier').value = '';
                document.getElementById('pur-inv').value = '';
                if(document.getElementById('pur-gstin')) document.getElementById('pur-gstin').value = '';
                renderPurchaseTable();
            }
        });
    }

    // Map Both Save buttons to process
    if(btnSave) btnSave.addEventListener('click', savePurchaseRecord);
    if(btnSavePrint) btnSavePrint.addEventListener('click', savePurchaseRecord);

    // Create Predictive dropdown
    createTableDropdown();
    renderPurchaseTable();
}

function createTableDropdown() {
    if(!document.getElementById('pur-table-dropdown')) {
        const div = document.createElement('div');
        div.id = 'pur-table-dropdown';
        // Changed to Fixed positioning to fix scroll/lag bug
        div.className = 'hidden fixed z-[9999] w-64 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xl max-h-48 overflow-y-auto text-sm';
        document.body.appendChild(div);
        
        // Hide Dropdown intelligently on scrolls to prevent ghost overlays
        const tableContainer = document.querySelector('.erp-table-container');
        if(tableContainer) {
            tableContainer.addEventListener('scroll', () => div.classList.add('hidden'));
        }
        const mainContainer = document.querySelector('main');
        if(mainContainer) {
            mainContainer.addEventListener('scroll', () => div.classList.add('hidden'));
        }
    }
}

function renderPurchaseTable() {
    const tbody = document.getElementById('pur-tbody');
    const isGstActive = document.getElementById('pur-gst-master')?.checked ?? true;
    
    // Hide/Show column headers
    document.querySelectorAll('.pur-gst-col').forEach(el => {
        el.style.display = isGstActive ? '' : 'none';
    });

    let html = '';
    window.purRows.forEach((row, index) => {
        html += `
        <tr data-index="${index}" class="group">
            <td class="text-center text-xs text-gray-400 border-r dark:border-gray-700">${index + 1}</td>
            <td class="border-r dark:border-gray-700"><input type="text" class="erp-input w-full pur-inp-item" value="${row.item}" placeholder="Item name..."></td>
            <td class="border-r dark:border-gray-700"><input type="text" class="erp-input w-full pur-inp-hsn text-center" value="${row.hsn}" placeholder="HSN"></td>
            <td class="border-r dark:border-gray-700"><input type="number" class="erp-input w-full pur-inp-qty text-right" value="${row.qty}" placeholder="0"></td>
            <td class="border-r dark:border-gray-700"><input type="text" class="erp-input w-full pur-inp-unit text-center text-gray-500" value="${row.unit}"></td>
            <td class="border-r dark:border-gray-700"><input type="number" step="0.01" class="erp-input w-full pur-inp-rate text-right" value="${row.rate}" placeholder="0.00"></td>
            <td class="border-r dark:border-gray-700 pur-gst-col" style="display: ${isGstActive ? '' : 'none'}"><input type="number" class="erp-input w-full pur-inp-gst text-center" value="${row.gst}" placeholder="%"></td>
            <td class="border-r dark:border-gray-700"><input type="text" readonly class="erp-input w-full text-right font-bold text-gray-600 bg-gray-50 dark:bg-gray-900/50 dark:text-gray-300" value="${row.taxable.toFixed(2)}"></td>
            <td class="border-r dark:border-gray-700 pur-gst-col" style="display: ${isGstActive ? '' : 'none'}"><input type="text" readonly class="erp-input w-full text-right font-bold text-gray-600 bg-gray-50 dark:bg-gray-900/50 dark:text-gray-300" value="${row.taxAmt.toFixed(2)}"></td>
            <td class="border-r dark:border-gray-700"><input type="text" readonly class="erp-input w-full text-right font-bold text-danger bg-red-50/30 dark:bg-red-900/10" value="${row.total.toFixed(2)}"></td>
            <td class="text-center">
                <button type="button" class="btn-pur-del text-gray-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-trash text-xs"></i></button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
    attachPurchaseRowListeners();
    calcPurchaseTotals();
}

function attachPurchaseRowListeners() {
    const tbody = document.getElementById('pur-tbody');
    const dropdown = document.getElementById('pur-table-dropdown');

    // Input changes
    tbody.querySelectorAll('tr').forEach((tr) => {
        const index = parseInt(tr.getAttribute('data-index'));
        
        tr.querySelector('.pur-inp-item').addEventListener('input', (e) => {
            window.purRows[index].item = e.target.value;
            handleTablePredictiveSearch(e.target, index);
        });
        
        tr.querySelector('.pur-inp-item').addEventListener('focus', (e) => {
            handleTablePredictiveSearch(e.target, index);
            showSmartAssistant(e.target.value);
        });

        tr.querySelector('.pur-inp-hsn').addEventListener('input', (e) => window.purRows[index].hsn = e.target.value);
        tr.querySelector('.pur-inp-unit').addEventListener('input', (e) => window.purRows[index].unit = e.target.value);
        
        ['pur-inp-qty', 'pur-inp-rate', 'pur-inp-gst'].forEach(cls => {
            const el = tr.querySelector(`.${cls}`);
            if(el) {
                el.addEventListener('input', (e) => {
                    let val = e.target.value;
                    if(cls === 'pur-inp-qty') window.purRows[index].qty = val;
                    if(cls === 'pur-inp-rate') window.purRows[index].rate = val;
                    if(cls === 'pur-inp-gst') window.purRows[index].gst = val;
                    calcRowValues(index);
                });
            }
        });

        const delBtn = tr.querySelector('.btn-pur-del');
        if(delBtn) {
            delBtn.addEventListener('click', () => {
                if(window.purRows.length > 1) {
                    window.purRows.splice(index, 1);
                    renderPurchaseTable();
                } else {
                    window.purRows[0] = { id: Date.now(), item: '', hsn: '', qty: '', unit: 'Pcs', rate: '', gst: 18, taxable: 0, taxAmt: 0, total: 0 };
                    renderPurchaseTable();
                }
            });
        }
    });

    // Close dropdown
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('pur-inp-item') && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

function handleTablePredictiveSearch(inputEl, rowIndex) {
    const dropdown = document.getElementById('pur-table-dropdown');
    const queryStr = String(inputEl.value).toLowerCase().trim();
    let filtered = allInventory;
    
    if (queryStr) {
        filtered = allInventory.filter(item => String(item.name || "").toLowerCase().includes(queryStr));
    }

    if(filtered.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }

    let html = '';
    filtered.slice(0, 10).forEach(item => {
        html += `
        <div class="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center dropdown-item" data-name="${item.name}" data-hsn="${item.hsn||''}" data-rate="${item.price||0}" data-gst="${item.hasGST ? '18' : '0'}">
            <span class="font-semibold text-gray-800 dark:text-gray-200">${item.name}</span>
            <span class="text-xs text-gray-500">Stock: ${item.qty||0}</span>
        </div>`;
    });

    dropdown.innerHTML = html;
    
    // Fixed positioning mapping based on Viewport bounding rect.
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${Math.max(rect.width, 250)}px`;
    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('.dropdown-item').forEach(el => {
        el.addEventListener('click', () => {
            window.purRows[rowIndex].item = el.getAttribute('data-name');
            window.purRows[rowIndex].hsn = el.getAttribute('data-hsn');
            // Fill rate as reference
            if(!window.purRows[rowIndex].rate) window.purRows[rowIndex].rate = el.getAttribute('data-rate');
            window.purRows[rowIndex].gst = el.getAttribute('data-gst');
            
            dropdown.classList.add('hidden');
            renderPurchaseTable(); // re-render to update inputs
            
            // Focus next input (qty)
            setTimeout(() => {
                const trs = document.getElementById('pur-tbody').querySelectorAll('tr');
                if(trs[rowIndex]) {
                    const qtyInp = trs[rowIndex].querySelector('.pur-inp-qty');
                    if(qtyInp) qtyInp.focus();
                }
            }, 50);
        });
    });
}

function showSmartAssistant(itemName) {
    const ast = document.getElementById('pur-smart-assistant');
    if(!ast) return;
    
    itemName = itemName.trim().toLowerCase();
    if(!itemName) {
        ast.innerHTML = `<h4 class="text-[10px] font-bold uppercase text-indigo-400 absolute top-2 left-3"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Line Assistant</h4><div class="mt-4 text-center text-indigo-400/80 font-medium italic animate-pulse">Waiting for item...</div>`;
        return;
    }

    const item = allInventory.find(i => String(i.name||'').toLowerCase() === itemName);
    if(item) {
        ast.innerHTML = `
            <h4 class="text-[10px] font-bold uppercase text-indigo-600 absolute top-2 left-3"><i class="fa-solid fa-info-circle mr-1"></i> Known Item Details</h4>
            <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div><span class="text-gray-500">Cur. Stock:</span> <span class="font-bold text-gray-800 dark:text-white">${item.qty || 0}</span></div>
                <div><span class="text-gray-500">Sale Rate:</span> <span class="font-bold text-success">₹${Number(item.price||0).toFixed(2)}</span></div>
                <div><span class="text-gray-500">HSN:</span> <span class="font-bold text-gray-800 dark:text-white">${item.hsn || 'N/A'}</span></div>
                <div><span class="text-gray-500">GST Setup:</span> <span class="font-bold text-gray-800 dark:text-white">${item.hasGST ? 'Yes' : 'No'}</span></div>
            </div>
        `;
    } else {
        ast.innerHTML = `<h4 class="text-[10px] font-bold uppercase text-warning absolute top-2 left-3"><i class="fa-solid fa-plus mr-1"></i> New Item</h4><div class="mt-4 text-center text-gray-600 dark:text-gray-400 font-medium text-xs">This item will be added to inventory upon saving.</div>`;
    }
}

function addPurchaseRow() {
    window.purRows.push({ id: Date.now(), item: '', hsn: '', qty: '', unit: 'Pcs', rate: '', gst: 18, taxable: 0, taxAmt: 0, total: 0 });
    renderPurchaseTable();
    // Focus new row's item input
    setTimeout(() => {
        const inputs = document.getElementById('pur-tbody').querySelectorAll('.pur-inp-item');
        if(inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
}

function calcRowValues(index) {
    const isGstActive = document.getElementById('pur-gst-master')?.checked ?? true;
    let row = window.purRows[index];
    
    let q = parseFloat(row.qty) || 0;
    let r = parseFloat(row.rate) || 0;
    let g = parseFloat(row.gst) || 0;

    row.taxable = q * r;
    row.taxAmt = isGstActive ? row.taxable * (g / 100) : 0;
    row.total = row.taxable + row.taxAmt;

    // Fast visual update without full re-render
    const trs = document.getElementById('pur-tbody').querySelectorAll('tr');
    if(trs[index]) {
        const inputs = trs[index].querySelectorAll('input[readonly]');
        if(inputs.length >= 3) {
            inputs[0].value = row.taxable.toFixed(2);
            inputs[1].value = row.taxAmt.toFixed(2);
            inputs[2].value = row.total.toFixed(2);
        }
    }
    calcPurchaseTotals();
}

function calcPurchaseTotals() {
    let totalTaxable = 0;
    let totalTax = 0;

    window.purRows.forEach(row => {
        totalTaxable += row.taxable;
        totalTax += row.taxAmt;
    });

    let grandRaw = totalTaxable + totalTax;
    let overrideMath = document.getElementById('pur-manual-override')?.checked;
    
    let grandTotal = overrideMath ? grandRaw : Math.round(grandRaw);
    let roundOff = grandTotal - grandRaw;

    if (document.getElementById('pur-t-taxable')) {
        document.getElementById('pur-t-taxable').innerText = `₹${totalTaxable.toFixed(2)}`;
        document.getElementById('pur-t-cgst').innerText = `₹${(totalTax / 2).toFixed(2)}`;
        document.getElementById('pur-t-sgst').innerText = `₹${(totalTax / 2).toFixed(2)}`;
        document.getElementById('pur-t-round').innerText = `₹${roundOff.toFixed(2)}`;
        document.getElementById('pur-t-grand').innerText = `₹${grandTotal.toFixed(2)}`;
    }
}

async function savePurchaseRecord(e) {
    // If the event targets the Save & Print button, you can track it here if necessary
    // const isPrint = e.target.closest('#btn-pur-saveprint') !== null;
    
    const btn = document.getElementById('btn-pur-save');
    if (btn.disabled) return;

    let validRows = window.purRows.filter(r => r.item && r.item.trim() && parseFloat(r.qty) > 0 && parseFloat(r.rate) >= 0);
    if (validRows.length === 0) return alert("Please enter at least one valid item with quantity and rate.");

    let dateInput = document.getElementById('pur-date').value;
    let dateStr = dateInput ? new Date(dateInput + 'T12:00:00').toISOString() : new Date().toISOString();
    
    let invNo = document.getElementById('pur-inv').value.trim().toUpperCase() || "N/A";
    let suppName = document.getElementById('pur-supplier').value.trim() || "Cash Purchase";
    let suppGstin = document.getElementById('pur-gstin')?.value.trim().toUpperCase() || "";
    let isGstActive = document.getElementById('pur-gst-master')?.checked ?? true;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    btn.classList.add('opacity-75', 'cursor-not-allowed');

    try {
        const batch = writeBatch(db);
        
        for (let i = 0; i < validRows.length; i++) {
            const r = validRows[i]; 
            const transRef = doc(collection(db, "transactions"));
            const localInv = allInventory.find(inv => String(inv.name||"").toLowerCase() === String(r.item||"").toLowerCase());
            
            batch.set(transRef, { 
                type: "Purchase", 
                item: r.item.trim(), 
                qty: parseFloat(r.qty), 
                rate: parseFloat(r.rate), 
                amount: r.total, 
                date: dateStr, 
                hasGST: isGstActive && parseFloat(r.gst) > 0, 
                hsn: r.hsn.trim(), 
                taxable: r.taxable, 
                cgst: r.taxAmt / 2, 
                sgst: r.taxAmt / 2, 
                igst: 0, 
                supplier: suppName, 
                supplierGstin: suppGstin, 
                invoice: invNo 
            });
            
            if (localInv) {
                batch.update(doc(db, "inventory", localInv.id), { 
                    qty: (Number(localInv.qty)||0) + parseFloat(r.qty), 
                    hsn: r.hsn.trim() || localInv.hsn || ""
                });
            } else {
                batch.set(doc(collection(db, "inventory")), { 
                    name: r.item.trim(), 
                    qty: parseFloat(r.qty), 
                    price: parseFloat(r.rate), // Average cost / rate
                    hasGST: isGstActive && parseFloat(r.gst) > 0, 
                    hsn: r.hsn.trim(), 
                    partNumber: "" 
                });
            }
        }
        await batch.commit();
        
        try {
            // Strictly check for existing supplier to prevent duplication
            const cleanSuppName = suppName.trim().toLowerCase();
            const existingSupplier = allSuppliers.find(s => s.name && s.name.trim().toLowerCase() === cleanSuppName);
            
            if (!existingSupplier && cleanSuppName !== "cash" && cleanSuppName !== "cash purchase") {
                await addDoc(collection(db, "suppliers"), { name: suppName.trim(), gstin: suppGstin, createdAt: dateStr });
            }
        } catch (err) { console.warn("Supplier database check failed.", err); }

        // Reset
        document.getElementById('btn-pur-reset').click();
        showSuccessAnimation(`Purchase Bill ${invNo !== 'N/A' ? invNo : ''} Saved!`);
        
    } catch (e) { 
        console.error("Purchase error", e);
        alert("Error saving purchase: " + e.message); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = originalHTML; 
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// ==========================================
// 11. SAVE LOGIC (Sales & Cosmetic)
// ==========================================
const saleForm = document.getElementById('form-sale');
if(saleForm) {
    saleForm.onsubmit = async (e) => {
        e.preventDefault(); 
        const submitBtn = document.getElementById('btn-save-sale'); 
        if (submitBtn.disabled) return;
        
        if (document.getElementById('sale-item').value.trim()) document.getElementById('btn-add-to-cart').click();
        if (!window.saleCart || window.saleCart.length === 0) { 
            alert("No items in the invoice to sell!"); 
            return; 
        }

        let custName = (document.getElementById('sale-customer')?.value.trim()) || "Cash / Walk-in";
        let custGstin = (document.getElementById('sale-gstin')?.value.trim().toUpperCase()) || "";
        
        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.disabled = true; 
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Invoice...`;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            const batch = writeBatch(db); 
            const date = new Date().toISOString(); 
            const invoiceNo = "INV-" + Date.now().toString().slice(-6);
            
            for (let i = 0; i < window.saleCart.length; i++) {
                const c = window.saleCart[i]; 
                const transRef = doc(collection(db, "transactions"));
                const localInv = (window.allInventory||[]).find(inv => String(inv.name||"").toLowerCase() === String(c.item||"").toLowerCase());
                
                batch.set(transRef, { 
                    type: "Sale", item: c.item, qty: c.qty, rate: c.rate, amount: c.amount, 
                    date: date, hasGST: c.hasGST, hsn: c.hsn, taxable: c.taxable, cgst: c.cgst, 
                    sgst: c.sgst, igst: c.igst, invoiceNo: invoiceNo, 
                    customerName: custName, customerGstin: custGstin 
                });
                
                if (localInv) {
                    let newQty = (Number(localInv.qty)||0) - c.qty; 
                    if (newQty < 0) newQty = 0;
                    batch.update(doc(db, "inventory", localInv.id), { 
                        qty: newQty, 
                        hsn: c.hsn || localInv.hsn || "" 
                    });
                }
            }
            
            await batch.commit(); 
            
            try {
                if (!(window.allCustomers||[]).find(c => c.name && c.name.toLowerCase()===custName.toLowerCase()) && custName.toLowerCase() !== "cash" && custName.toLowerCase() !== "cash / walk-in") {
                    await addDoc(collection(db, "customers"), { name: custName, gstin: custGstin, createdAt: date });
                }
            } catch (err) { console.warn("Customer database check failed.", err); }
            
            window.saleCart =[]; 
            updateCartUI(); 
            saleForm.reset(); 
            const gstInd = document.getElementById('gst-indicator');
            if(gstInd) gstInd.classList.add('hidden');
            
            showSuccessAnimation(`Invoice ${invoiceNo} Generated!`);
            
        } catch (error) { 
            console.error("Sale error", error);
            alert("Error saving sale: " + error.message); 
        } finally { 
            submitBtn.disabled = false; 
            submitBtn.innerHTML = originalBtnHTML; 
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    };
}

const cosmeticForm = document.getElementById('form-cosmetic');
if (cosmeticForm) {
    cosmeticForm.onsubmit = async (e) => {
        e.preventDefault(); 
        const submitBtn = cosmeticForm.querySelector('button[type="submit"]'); 
        if (submitBtn.disabled) return;
        
        const originalBtnHTML = submitBtn.innerHTML; 
        submitBtn.disabled = true; 
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
        
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
        }
    };
}

// ==========================================
// 12. GST EXCEL EXPORT REPORT
// ==========================================
const btnExportGst = document.getElementById('btn-export-gst');
if(btnExportGst) {
    btnExportGst.addEventListener('click', () => {
        const sDate = document.getElementById('gst-export-start').value;
        const eDate = document.getElementById('gst-export-end').value;
        if(!sDate || !eDate) { alert("Please select both Start and End dates."); return; }

        const startObj = new Date(sDate + 'T00:00:00'); 
        const endObj = new Date(eDate + 'T23:59:59');
        const sales = []; 
        const purchases =[];

        allTransactions.forEach(t => {
            if(!t.hasGST) return; 
            const tDateObj = new Date(t.date);
            if(tDateObj < startObj || tDateObj > endObj) return;

            const row = {
                "Date": tDateObj.toLocaleDateString('en-GB'),
                "Invoice Number": t.invoiceNo || t.invoice || "N/A",
                "Party Name": t.customerName || t.supplier || "Cash Party",
                "GSTIN": t.customerGstin || t.supplierGstin || "Unregistered",
                "Item Name / Description": t.item,
                "HSN Code": t.hsn || "N/A",
                "Quantity": t.qty,
                "Taxable Value (₹)": Number(t.taxable || (t.amount - (t.cgst||0) - (t.sgst||0) - (t.igst||0))).toFixed(2),
                "CGST (₹)": Number(t.cgst || 0).toFixed(2),
                "SGST (₹)": Number(t.sgst || 0).toFixed(2),
                "IGST (₹)": Number(t.igst || 0).toFixed(2),
                "Total Invoice Value (₹)": Number(t.amount || 0).toFixed(2)
            };

            if(t.type === 'Sale') sales.push(row);
            if(t.type === 'Purchase') purchases.push(row);
        });

        if(sales.length === 0 && purchases.length === 0) { 
            alert("No GST transactions found in this date range."); 
            return; 
        }

        const wb = XLSX.utils.book_new();
        if(sales.length > 0) { 
            const wsSales = XLSX.utils.json_to_sheet(sales); 
            XLSX.utils.book_append_sheet(wb, wsSales, "GST_Sales"); 
        }
        if(purchases.length > 0) { 
            const wsPurch = XLSX.utils.json_to_sheet(purchases); 
            XLSX.utils.book_append_sheet(wb, wsPurch, "GST_Purchases"); 
        }
        XLSX.writeFile(wb, `GST_Filing_Report_${sDate}_to_${eDate}.xlsx`);
    });
}

// ==========================================
// 13. ANALYTICS & DASHBOARD METRICS
// ==========================================
function updateDashboardMetrics() {
    if (!allInventory || !allTransactions) return;
    const todayISO = new Date().toISOString().split('T')[0];
    let invMap = {}; let invValue = 0; let lowStockCount = 0; let totalStockUnits = 0;
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
            if (isToday) { todaySales += amt; todayCogs += cost; todayItemsSold += qty; todayItemTrends[t.item] = (todayItemTrends[t.item] || 0) + qty; }
        } else if (t.type === 'Sale Return' || t.type === 'Cosmetic Return') {
            overallSales -= amt; 
            let cost = t.type === 'Sale Return' ? ((invMap[t.item]?.cost || 0) * qty) : ((Number(t.cost) || 0) * qty); 
            overallCogs -= cost;
            if (isToday) { todaySales -= amt; todayCogs -= cost; todayItemsSold -= qty; todayItemTrends[t.item] = (todayItemTrends[t.item] || 0) - qty; }
        }
    });
    
    let todayProfit = todaySales - todayCogs; 
    let todayMargin = todaySales > 0 ? ((todayProfit / todaySales) * 100).toFixed(1) : 0; 
    let overallProfit = overallSales - overallCogs;
    let trendingItem = "N/A"; let maxQty = 0;
    
    for (const[itemName, count] of Object.entries(todayItemTrends)) { 
        if (count > maxQty) { maxQty = count; trendingItem = itemName; } 
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
if(dashMonthSelect) dashMonthSelect.addEventListener('change', renderDashboardTopItems); 
if(dashTypeSelect) dashTypeSelect.addEventListener('change', renderDashboardTopItems);

function updateDashboardMonths(transactions) {
    if(!dashMonthSelect) return;
    const currentSelection = dashMonthSelect.value; 
    let monthsSet = new Set(); 
    monthsSet.add(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
    
    transactions.forEach(t => { 
        if (!isYearMatch(t.date)) return; 
        monthsSet.add(new Date(t.date).toLocaleString('default', { month: 'long', year: 'numeric' })); 
    });
    
    let html = ''; 
    Array.from(monthsSet).forEach(m => { html += `<option value="${m}">${m}</option>`; });
    dashMonthSelect.innerHTML = html; 
    if (currentSelection && monthsSet.has(currentSelection)) dashMonthSelect.value = currentSelection;
}

function renderDashboardTopItems() {
    if(!dashMonthSelect || !dashTypeSelect) return;
    const selectedMonth = dashMonthSelect.value; 
    const selectedType = dashTypeSelect.value; 
    const listContainer = document.getElementById('dash-top-list'); 
    let itemSalesMap = {};
    
    allTransactions.forEach(t => {
        if (!isYearMatch(t.date)) return; 
        if (!t.type.includes('Sale')) return; 
        if (selectedType !== 'All' && t.type !== selectedType) return;
        
        const monthKey = new Date(t.date).toLocaleString('default', { month: 'long', year: 'numeric' }); 
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
        listContainer.innerHTML += `<li class="flex justify-between items-center py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"><div class="text-sm font-medium"><span class="mr-3">${rankIcon}</span> ${item.name}</div><div class="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded">${item.sold} sold</div></li>`;
        rank++;
    });
}

// ==========================================
// 14. TRANSACTIONS LEDGER & RETURNS
// ==========================================
const btnTransFilter = document.getElementById('btn-trans-filter');
const btnTransClear = document.getElementById('btn-trans-clear');
if(btnTransFilter) btnTransFilter.addEventListener('click', renderTransactionsTable);
if(btnTransClear) btnTransClear.addEventListener('click', () => { 
    document.getElementById('filter-trans-start').value = ''; 
    document.getElementById('filter-trans-end').value = ''; 
    document.getElementById('filter-trans-gst').value = 'All'; 
    renderTransactionsTable(); 
});

function renderTransactionsTable() {
    const tbody = document.querySelector('#table-transactions tbody');
    if(!tbody) return;
    
    const startVal = document.getElementById('filter-trans-start').value; 
    const endVal = document.getElementById('filter-trans-end').value; 
    const gstFilter = document.getElementById('filter-trans-gst').value;
    
    let sD = startVal ? new Date(startVal + 'T00:00:00') : null; 
    let eD = endVal ? new Date(endVal + 'T23:59:59') : null; 
    let html =[];
    
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
        if (t.type === 'Purchase' && t.supplier) extraInfo += `<span class="block text-[10px] text-gray-500 mt-0.5">Supp: ${t.supplier} | Inv: ${t.invoice || 'N/A'}</span>`;
        if (t.type === 'Sale' && t.invoiceNo) extraInfo += `<span class="block text-[10px] text-gray-500 mt-0.5">Inv: ${t.invoiceNo}</span>`;

        html.push(`<tr><td class="px-6 py-4 whitespace-nowrap">${tDate.toLocaleDateString()}</td><td class="px-6 py-4 whitespace-nowrap font-bold ${tColorClass}">${t.type}</td><td class="px-6 py-4"><div class="flex items-center">${t.item || "Unknown"} ${gstBadge}</div>${extraInfo}</td><td class="px-6 py-4 whitespace-nowrap">${Number(t.qty) || 0}</td><td class="px-6 py-4 whitespace-nowrap font-semibold">₹${(Number(t.amount) || 0).toFixed(2)}</td><td class="px-6 py-4 text-center whitespace-nowrap">${actionBtn}</td></tr>`);
    });
    tbody.innerHTML = html.join('');
}

document.querySelector('#table-transactions tbody')?.addEventListener('click', async (e) => {
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
                    let newStock = Number(localInvItem.qty); 
                    if (t.type === 'Sale') newStock += returnQty; 
                    else if (t.type === 'Purchase') newStock -= returnQty; 
                    if(newStock < 0) newStock = 0; 
                    batch.update(doc(db, "inventory", localInvItem.id), { qty: newStock }); 
                } 
            }
            await batch.commit(); 
            showSuccessAnimation("Return Processed Successfully!");
        } catch (err) { 
            alert("Error processing the return."); 
            btn.disabled = false; 
            btn.innerHTML = originalHTML; 
            btn.classList.remove('opacity-50', 'cursor-not-allowed'); 
        }
    }
});

// ==========================================
// 15. IN DEPTH ANALYTICS (Charts & Tables)
// ==========================================
document.getElementById('btn-ana-filter')?.addEventListener('click', runAnalytics); 
document.getElementById('btn-ana-clear')?.addEventListener('click', () => { document.getElementById('ana-start').value = ''; document.getElementById('ana-end').value = ''; runAnalytics(); }); 
document.getElementById('btn-ana-today')?.addEventListener('click', () => { const today = new Date().toISOString().split('T')[0]; document.getElementById('ana-start').value = today; document.getElementById('ana-end').value = today; runAnalytics(); }); 
document.getElementById('ana-class-filter')?.addEventListener('change', runAnalytics); 
document.getElementById('filter-top-selling')?.addEventListener('change', runAnalytics); 
document.getElementById('filter-inv-status')?.addEventListener('change', runAnalytics);

function runAnalytics() {
    if(!document.getElementById('tab-analytics')?.classList.contains('active')) return;
    const startVal = document.getElementById('ana-start').value; 
    const endVal = document.getElementById('ana-end').value; 
    let startDate = startVal ? new Date(startVal + 'T00:00:00') : null; 
    let endDate = endVal ? new Date(endVal + 'T23:59:59') : null; 
    
    let revenue = 0; let cogs = 0; let itemStats = {}; let monthlyData = {};
    
    allInventory.forEach(inv => { 
        itemStats[inv.name] = { stock: inv.qty, unitCost: inv.price, invValue: (inv.qty * inv.price), qtySold: 0, totalRevenue: 0 }; 
    });
    
    allTransactions.forEach(trans => {
        if (!isYearMatch(trans.date)) return; 
        const tDate = new Date(trans.date); 
        if (startDate && tDate < startDate) return; 
        if (endDate && tDate > endDate) return;
        
        const monthKey = tDate.toLocaleString('default', { month: 'short', year: 'numeric' }); 
        if(!monthlyData[monthKey]) monthlyData[monthKey] = { sales: 0, profit: 0 };
        
        if(trans.type === 'Sale') {
            revenue += trans.amount; monthlyData[monthKey].sales += trans.amount; let cost = 0;
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
            revenue -= trans.amount; monthlyData[monthKey].sales -= trans.amount; let cost = 0;
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
    
    if(document.getElementById('ana-revenue')) {
        document.getElementById('ana-revenue').innerText = `₹${revenue.toFixed(2)}`; 
        document.getElementById('ana-profit').innerText = `₹${profit.toFixed(2)}`; 
        document.getElementById('ana-margin').innerText = `${margin}%`; 
        document.getElementById('ana-stock').innerText = totalStock;
    }
    
    let totalInvValue = 0; let abcArray = []; 
    for (const[name, data] of Object.entries(itemStats)) { 
        totalInvValue += data.invValue; abcArray.push({ name, value: data.invValue }); 
    } 
    abcArray.sort((a,b) => b.value - a.value);
    
    let cumValue = 0; let abcTotals = { A: 0, B: 0, C: 0 }; let abcHtml =[];
    abcArray.forEach(item => { 
        cumValue += item.value; 
        let pct = totalInvValue > 0 ? cumValue / totalInvValue : 0; 
        let category = 'C'; let catClass = 'text-danger'; 
        if(pct <= 0.70) { abcTotals.A += item.value; category = 'A'; catClass = 'text-success'; } 
        else if (pct <= 0.90) { abcTotals.B += item.value; category = 'B'; catClass = 'text-warning'; } 
        else { abcTotals.C += item.value; category = 'C'; } 
        abcHtml.push(`<tr><td class="py-3 px-4">${item.name}</td><td class="py-3 px-4">₹${item.value.toFixed(2)}</td><td class="py-3 px-4">${(pct * 100).toFixed(1)}%</td><td class="py-3 px-4 font-bold ${catClass}">${category}</td></tr>`); 
    });
    if(document.querySelector('#table-abc tbody')) document.querySelector('#table-abc tbody').innerHTML = abcHtml.join('');
    
    const filterTop = document.getElementById('filter-top-selling')?.value; 
    let topHtml =[]; 
    let sortedTop = Object.keys(itemStats).map(k => ({name: k, sold: itemStats[k].qtySold})).sort((a,b) => b.sold - a.sold); 
    if(filterTop === 'Top10') sortedTop = sortedTop.slice(0, 10); 
    sortedTop.forEach(item => { 
        if(item.sold > 0 || filterTop === 'All') topHtml.push(`<tr><td class="py-2 px-3">${item.name}</td><td class="py-2 px-3 text-right font-bold text-success">${item.sold}</td></tr>`); 
    }); 
    if(document.getElementById('tbody-top-selling')) document.getElementById('tbody-top-selling').innerHTML = topHtml.join('');
    
    const filterInv = document.getElementById('filter-inv-status')?.value; 
    let invHtml =[]; 
    let sortedInv = Object.keys(itemStats).map(k => ({name: k, stock: itemStats[k].stock})).sort((a,b) => a.stock - b.stock); 
    sortedInv.forEach(item => { 
        if (filterInv === 'Low' && item.stock > 3) return; 
        invHtml.push(`<tr><td class="py-2 px-3">${item.name}</td><td class="py-2 px-3 text-right ${item.stock <= 3 ? 'text-danger font-bold' : ''}">${item.stock}</td></tr>`); 
    }); 
    if(document.getElementById('tbody-inv-status')) document.getElementById('tbody-inv-status').innerHTML = invHtml.join('');
    
    let fsnTotals = { F: 0, S: 0, N: 0 }; 
    let matrixRows =[]; 
    let maxQtySold = Math.max(...Object.values(itemStats).map(i => i.qtySold), 0); 
    let maxRev = Math.max(...Object.values(itemStats).map(i => i.totalRevenue), 0);
    
    for (const[name, data] of Object.entries(itemStats)) {
        let FSN = 'N'; 
        if (data.qtySold > 0) FSN = data.qtySold >= (maxQtySold * 0.5) ? 'F' : 'S'; 
        fsnTotals[FSN] += data.stock;
        
        let HMV = 'V'; 
        if (data.totalRevenue > 0) HMV = data.totalRevenue >= (maxRev * 0.5) ? 'H' : 'M'; 
        let actClass = "";
        
        if(FSN==='F' && HMV==='H') actClass = "⭐ Stars"; 
        else if(FSN==='S' && HMV==='H') actClass = "💰 Cash Cows"; 
        else if(FSN==='N' && HMV==='H') actClass = "🔥 Dead Weight"; 
        else if(FSN==='F' && HMV==='M') actClass = "🚀 Drivers"; 
        else if(FSN==='S' && HMV==='M') actClass = "🐢 Slugs"; 
        else if(FSN==='N' && HMV==='M') actClass = "💤 Sleepers"; 
        else if(FSN==='F' && HMV==='V') actClass = "🏃 Runners"; 
        else if(FSN==='S' && HMV==='V') actClass = "📦 Basics"; 
        else if(FSN==='N' && HMV==='V') actClass = "🗑️ Dead Stock"; 
        
        matrixRows.push({ name, stock: data.stock, invValue: data.invValue, rev: data.totalRevenue, FSN, HMV, actClass });
    }
    
    const filterClass = document.getElementById('ana-class-filter')?.value; 
    let matrixHtml =[]; 
    matrixRows.sort((a,b) => b.rev - a.rev).forEach(row => { 
        if(filterClass !== "All" && !row.actClass.includes(filterClass)) return; 
        let fsnColor = row.FSN==='F'?'text-success':(row.FSN==='S'?'text-warning':'text-danger'); 
        let hmvColor = row.HMV==='H'?'text-primary':(row.HMV==='M'?'text-purple-500':'text-gray-500'); 
        matrixHtml.push(`<tr><td class="py-3 px-4 font-bold">${row.name}</td><td class="py-3 px-4">${row.stock}</td><td class="py-3 px-4">₹${row.invValue.toFixed(2)}</td><td class="py-3 px-4">₹${row.rev.toFixed(2)}</td><td class="py-3 px-4 font-bold ${fsnColor}">${row.FSN}</td><td class="py-3 px-4 font-bold ${hmvColor}">${row.HMV}</td><td class="py-3 px-4">${row.actClass}</td></tr>`); 
    }); 
    if(document.querySelector('#table-matrix tbody')) document.querySelector('#table-matrix tbody').innerHTML = matrixHtml.join('');
    
    lastMonthlyData = monthlyData; 
    lastAbcTotals = abcTotals; 
    lastFsnTotals = fsnTotals; 
    renderCharts(monthlyData, abcTotals, fsnTotals);
}

function renderCharts(monthlyData, abcTotals, fsnTotals) {
    if(!window.Chart) return;
    if(myChartMonthly) myChartMonthly.destroy(); 
    if(myChartABC) myChartABC.destroy(); 
    if(myChartFSN) myChartFSN.destroy();
    
    const labelsMonth = Object.keys(monthlyData).reverse(); 
    const dataSales = labelsMonth.map(m => monthlyData[m].sales); 
    const dataProfit = labelsMonth.map(m => monthlyData[m].profit); 
    const isDark = document.body.classList.contains('dark-mode'); 
    const chartTextColor = isDark ? '#e0e0e0' : '#2c3e50'; 
    Chart.defaults.color = chartTextColor;
    
    const monthlyCtx = document.getElementById('chart-monthly');
    if(monthlyCtx) {
        myChartMonthly = new Chart(monthlyCtx, { 
            type: 'bar', 
            data: { labels: labelsMonth.length ? labelsMonth :["No Data"], datasets:[{ label: 'Sales (₹)', data: dataSales, backgroundColor: '#3b82f6' }, { label: 'Profit (₹)', data: dataProfit, backgroundColor: '#10b981' }] }, 
            options: { responsive: true, plugins: { title: { display: true, text: 'Monthly Sales vs Profit', color: chartTextColor } }, animation: { duration: 0 } } 
        });
    }
    
    const abcCtx = document.getElementById('chart-abc');
    if(abcCtx) {
        myChartABC = new Chart(abcCtx, { 
            type: 'doughnut', 
            data: { labels:['A (Top Value)', 'B (Medium)', 'C (Low)'], datasets: [{ data:[abcTotals.A, abcTotals.B, abcTotals.C], backgroundColor:['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] }, 
            options: { responsive: true, plugins: { title: { display: true, text: 'Inventory Value by ABC', color: chartTextColor } }, animation: { duration: 0 } } 
        });
    }
    
    const fsnCtx = document.getElementById('chart-fsn');
    if(fsnCtx) {
        myChartFSN = new Chart(fsnCtx, { 
            type: 'pie', 
            data: { labels:['Fast Moving', 'Slow Moving', 'Non-Moving'], datasets: [{ data:[fsnTotals.F, fsnTotals.S, fsnTotals.N], backgroundColor:['#3b82f6', '#f59e0b', '#9ca3af'], borderWidth: 0 }] }, 
            options: { responsive: true, plugins: { title: { display: true, text: 'Stock Units by FSN', color: chartTextColor } }, animation: { duration: 0 } } 
        });
    }
}

// ==========================================
// 16. INVENTORY MANAGEMENT (Table, Add, Edit)
// ==========================================
function updateInventoryStats() {
    let totalItems = allInventory.length; let outCount = 0; let lowCount = 0; let totalValue = 0;
    allInventory.forEach(item => { 
        const qty = Number(item.qty) || 0; 
        const price = Number(item.price) || 0; 
        totalValue += (qty * price); 
        if (qty === 0) outCount++; else if (qty <= 2) lowCount++; 
    });
    
    if(document.getElementById('stat-inv-total')) {
        document.getElementById('stat-inv-total').innerText = totalItems; 
        document.getElementById('stat-inv-value').innerText = `₹${totalValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`; 
        document.getElementById('stat-inv-out').innerText = outCount; 
        document.getElementById('stat-inv-low').innerText = lowCount;
    }
}

function renderInventoryTable() {
    const tbody = document.querySelector('#table-inventory tbody');
    if(!tbody) return;
    
    let rowsHtml =[]; 
    const queryStr = currentInventorySearch.toLowerCase().trim();
    let filtered = allInventory.filter(item => { 
        const itemName = (item.name || "").toLowerCase(); 
        const itemPart = (item.partNumber || "").toLowerCase(); 
        const itemHsn = (item.hsn || "").toLowerCase();
        const qty = Number(item.qty) || 0; 
        if (queryStr && !itemName.includes(queryStr) && !itemPart.includes(queryStr) && !itemHsn.includes(queryStr)) return false; 
        if (currentInventoryFilter === 'out' && qty !== 0) return false; 
        if (currentInventoryFilter === 'low' && (qty === 0 || qty > 2)) return false; 
        return true; 
    });
    
    filtered.forEach((item) => {
        const itemName = item.name || "Unknown"; 
        const itemPart = item.partNumber ? `<span class="text-[10px] text-gray-400 block -mt-1">PN: ${item.partNumber}</span>` : ''; 
        const itemHsn = item.hsn ? `<span class="text-[10px] text-indigo-400 block">HSN: ${item.hsn}</span>` : '';
        const itemQty = Number(item.qty) || 0; 
        const itemPrice = Number(item.price) || 0; 
        const stockValue = itemQty * itemPrice;
        
        let badgeHtml = ""; 
        if (itemQty === 0) badgeHtml = `<span class="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full whitespace-nowrap">Out of stock</span>`; 
        else if (itemQty <= 2) badgeHtml = `<span class="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full whitespace-nowrap">Low &mdash; ${itemQty} left</span>`; 
        else badgeHtml = `<span class="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full whitespace-nowrap">${itemQty} in stock</span>`;
        
        let gstBadge = item.hasGST ? `<span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold uppercase">GST</span>` : '';
        
        rowsHtml.push(`<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"><td class="px-5 py-4"><div class="font-medium text-gray-900 dark:text-white flex items-center">${itemName} ${gstBadge}</div>${itemPart}${itemHsn}</td><td class="px-5 py-4 text-right text-gray-900 dark:text-gray-100 font-medium">${itemQty}</td><td class="px-5 py-4 text-right text-gray-900 dark:text-gray-100">₹${itemPrice.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td class="px-5 py-4 text-right text-gray-600 dark:text-gray-400 font-medium">₹${stockValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td class="px-5 py-4 text-right">${badgeHtml}</td><td class="px-5 py-4 text-right"><div class="flex justify-end gap-2"><button class="btn-edit w-8 h-8 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-colors" data-id="${item.id}" data-name="${itemName}" data-qty="${itemQty}" data-price="${itemPrice}" data-gst="${item.hasGST ? 'true' : ''}" data-part="${item.partNumber || ''}" data-hsn="${item.hsn || ''}" title="Edit"><i class="fa-solid fa-pen pointer-events-none text-xs"></i></button><button class="btn-delete w-8 h-8 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-danger hover:border-red-200 transition-colors" data-id="${item.id}" title="Delete"><i class="fa-solid fa-xmark pointer-events-none"></i></button></div></td></tr>`);
    });
    
    if (filtered.length === 0) rowsHtml.push(`<tr><td colspan="6" class="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No items found.</td></tr>`); 
    tbody.innerHTML = rowsHtml.join('');
}

document.getElementById('search-inventory')?.addEventListener('input', (e) => { 
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
if(inventoryForm) {
    inventoryForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const name = document.getElementById('inv-name').value.trim(); 
        const partNumber = document.getElementById('inv-part').value.trim(); 
        let qty = parseInt(document.getElementById('inv-qty').value); 
        let price = parseFloat(document.getElementById('inv-price').value); 
        const hasGST = document.getElementById('inv-gst').checked;
        
        if (isNaN(qty)) qty = 0; if (isNaN(price)) price = 0;
        const editId = inventoryForm.getAttribute('data-edit-id'); 
        const existingHsn = inventoryForm.getAttribute('data-edit-hsn') || "";
        
        if (editId) { 
            await updateDoc(doc(db, "inventory", editId), { name, qty, price, hasGST, partNumber, hsn: existingHsn }); 
            resetInventoryForm(); 
            showSuccessAnimation("Item Updated!"); 
        } else { 
            await addDoc(collection(db, "inventory"), { name, qty, price, hasGST, partNumber, hsn: "" }); 
            inventoryForm.reset(); 
            showSuccessAnimation("Item Added to Stock!"); 
        }
    });
}

document.getElementById('btn-inv-cancel')?.addEventListener('click', resetInventoryForm);

function resetInventoryForm() { 
    if(!inventoryForm) return;
    inventoryForm.reset(); 
    inventoryForm.removeAttribute('data-edit-id'); 
    inventoryForm.removeAttribute('data-edit-hsn'); 
    document.getElementById('btn-inv-submit').innerText = "Save"; 
    document.getElementById('inv-form-title').innerText = "Add new item"; 
    document.getElementById('btn-inv-cancel').style.display = "none"; 
}

document.querySelector('#table-inventory tbody')?.addEventListener('click', async (e) => {
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
        inventoryForm.setAttribute('data-edit-hsn', btnEdit.getAttribute('data-hsn') || ''); 
        
        document.getElementById('btn-inv-submit').innerText = "Update"; 
        document.getElementById('inv-form-title').innerText = `Edit item`; 
        document.getElementById('btn-inv-cancel').style.display = "inline-block"; 
        document.getElementById('inv-name').focus(); 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }
});

// ==========================================
// 17. DATA MANAGEMENT (Settings & Excel)
// ==========================================
document.getElementById('btn-trigger-excel')?.addEventListener('click', () => { 
    document.getElementById('excel-file').click(); 
});

document.getElementById('excel-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; 
    if(!file) return; 
    if(!confirm("WARNING: This will DELETE all current inventory and replace it entirely with the data from the Excel file. Are you absolutely sure?")) { 
        e.target.value = ''; return; 
    }
    
    const btn = document.getElementById('btn-trigger-excel'); 
    const ogText = btn.innerHTML; 
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-2xl"></i> <span class="text-sm">Importing...</span>`; 
    btn.disabled = true;
    
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
                const hsnVal = row['hsn'] || row['HSN Code'] || row['HSN'];
                
                if(name && name.trim() !== '') { 
                    const qty = Number(qtyStr) || 0; 
                    const price = Number(rateStr) || 0; 
                    const hasGST = (String(gstVal).toLowerCase() === 'yes' || String(gstVal).toLowerCase() === 'true'); 
                    const partNumber = partStr ? String(partStr).trim() : ''; 
                    const hsn = hsnVal ? String(hsnVal).trim() : '';
                    
                    await addDoc(collection(db, "inventory"), { name: name.trim(), qty, price, hasGST, partNumber, hsn }); 
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

document.getElementById('btn-sync-drive')?.addEventListener('click', () => { 
    alert("Sync to Google Drive initiated."); 
});

document.getElementById('btn-merge-dup')?.addEventListener('click', async () => {
    if(!confirm("Are you sure you want to scan and merge identical items?")) return;
    const btn = document.getElementById('btn-merge-dup'); 
    const ogText = btn.innerHTML; 
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-2xl"></i> <span class="text-sm">Merging...</span>`; 
    btn.disabled = true;
    
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
                let finalHsn = itemsMap[key][0].hsn || '';
                
                itemsMap[key].forEach(i => { 
                    let iQty = Number(i.qty) || 0; 
                    let iPrice = Number(i.price) || 0; 
                    totalQty += iQty; totalPriceObj += (iQty * iPrice); 
                    if (i.hasGST) hasGST = true; 
                    if (!finalPartNumber && i.partNumber) finalPartNumber = i.partNumber; 
                    if (!finalHsn && i.hsn) finalHsn = i.hsn;
                });
                
                let avgPrice = totalQty > 0 ? (totalPriceObj / totalQty) : 0; 
                await updateDoc(doc(db, "inventory", mainId), { qty: totalQty, price: avgPrice, hasGST: hasGST, partNumber: finalPartNumber, hsn: finalHsn });
                
                for(let i = 1; i < itemsMap[key].length; i++) { 
                    await deleteDoc(doc(db, "inventory", itemsMap[key][i].id)); 
                }
            }
        }
        if(mergeCount > 0) showSuccessAnimation(`Merged ${mergeCount} Duplicate Groups!`); 
        else alert("No duplicates found.");
    } catch (err) { 
        console.error(err); alert("An error occurred during merge."); 
    } finally { 
        btn.innerHTML = ogText; btn.disabled = false; 
    }
});
