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

window.saleCart = [];

let globalYearFilter = "All";
let myChartMonthly = null;
let myChartABC = null;
let myChartFSN = null;

let currentInventorySearch = "";
let currentInventoryFilter = "all";

let lastMonthlyData = {};
let lastAbcTotals = {};
let lastFsnTotals = {};

const LOCAL_STATE_CODE = "22";

let todayDateObj = new Date();
let todayIsoString = todayDateObj.toISOString();
let todayStrArray = todayIsoString.split('T');
let todayStr = todayStrArray[0];

let filterTransStart = document.getElementById('filter-trans-start');
if (filterTransStart) {
    filterTransStart.value = todayStr;
}

let filterTransEnd = document.getElementById('filter-trans-end');
if (filterTransEnd) {
    filterTransEnd.value = todayStr;
}

let purDate = document.getElementById('pur-date');
if (purDate) {
    purDate.value = todayStr;
}

let gstExportStart = document.getElementById('gst-export-start');
if (gstExportStart) {
    gstExportStart.value = todayStr;
}

let gstExportEnd = document.getElementById('gst-export-end');
if (gstExportEnd) {
    gstExportEnd.value = todayStr;
}

let anaStart = document.getElementById('ana-start');
if (anaStart) {
    anaStart.value = todayStr;
}

let anaEnd = document.getElementById('ana-end');
if (anaEnd) {
    anaEnd.value = todayStr;
}

function showSuccessAnimation(messageString) {
    let overlay = document.getElementById('success-overlay');
    let card = document.getElementById('success-card');
    
    if (!overlay) {
        return;
    }
    if (!card) {
        return;
    }

    let defaultMessage = "Success!";
    let finalMessage = messageString;
    
    if (!finalMessage) {
        finalMessage = defaultMessage;
    }

    let msgElement = document.getElementById('success-msg');
    msgElement.innerText = finalMessage;

    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    overlay.classList.add('pointer-events-auto');
    
    card.classList.remove('scale-50');
    card.classList.add('scale-100');
    
    setTimeout(function() {
        overlay.classList.remove('opacity-100');
        overlay.classList.remove('pointer-events-auto');
        
        overlay.classList.add('opacity-0');
        overlay.classList.add('pointer-events-none');
        
        card.classList.remove('scale-100');
        card.classList.add('scale-50');
        
        setTimeout(function() {
            overlay.classList.add('hidden');
        }, 300);
        
    }, 2000);
}

function isYearMatch(dateStr) {
    if (globalYearFilter === "All") {
        return true;
    }
    if (!dateStr) {
        return false;
    }
    
    let dateObject = new Date(dateStr);
    let fullYear = dateObject.getFullYear();
    let yearString = fullYear.toString();
    
    if (yearString === globalYearFilter) {
        return true;
    }
    
    return false;
}

function updateYearDropdown(transactionsArray) {
    let selectEl = document.getElementById('global-year-filter');
    
    if (!selectEl) {
        return;
    }
    
    let currentVal = selectEl.value;
    let yearsSet = new Set();
    
    for (let i = 0; i < transactionsArray.length; i++) {
        let currentTransaction = transactionsArray[i];
        let transactionDate = currentTransaction.date;
        
        if (transactionDate) {
            let parsedDate = new Date(transactionDate);
            let parsedYear = parsedDate.getFullYear();
            let parsedYearString = parsedYear.toString();
            yearsSet.add(parsedYearString);
        }
    }
    
    let htmlContent = `<option value="All">All Years</option>`;
    let yearsArray = Array.from(yearsSet);
    
    yearsArray.sort(function(a, b) {
        return b - a;
    });
    
    for (let j = 0; j < yearsArray.length; j++) {
        let yearValue = yearsArray[j];
        htmlContent += `<option value="${yearValue}">${yearValue}</option>`;
    }
    
    selectEl.innerHTML = htmlContent;
    
    let hasCurrentVal = yearsSet.has(currentVal);
    let isAllVal = currentVal === "All";
    
    if (hasCurrentVal || isAllVal) {
        selectEl.value = currentVal;
    } else {
        selectEl.value = "All";
    }
    
    globalYearFilter = selectEl.value;
}

let btnThemeToggle = document.getElementById('btn-theme-toggle');

if (btnThemeToggle) {
    let currentTheme = localStorage.getItem('theme');
    
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        btnThemeToggle.innerText = "Switch to Light Mode";
    }
    
    btnThemeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        
        let isDarkMode = document.body.classList.contains('dark-mode');
        
        if (isDarkMode) {
            btnThemeToggle.innerText = "Switch to Light Mode";
            localStorage.setItem('theme', 'dark');
        } else {
            btnThemeToggle.innerText = "Switch to Dark Mode";
            localStorage.setItem('theme', 'light');
        }
        
        if (myChartMonthly !== null) {
            renderCharts(lastMonthlyData, lastAbcTotals, lastFsnTotals);
        }
    });
}

onAuthStateChanged(auth, function(user) {
    let loginContainer = document.getElementById('login-container');
    let appContainer = document.getElementById('app-container');
    
    if (user) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        
        startDatabaseListeners();
        setupPredictiveSearchSale();
        setupCustomerSearch();
        initERPGrid();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        
        stopDatabaseListeners();
    }
});

let formLogin = document.getElementById('form-login');

if (formLogin) {
    formLogin.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        let emailInput = document.getElementById('login-email');
        let passwordInput = document.getElementById('login-password');
        let emailValue = emailInput.value;
        let passwordValue = passwordInput.value;
        
        try {
            await signInWithEmailAndPassword(auth, emailValue, passwordValue);
            
            let loginError = document.getElementById('login-error');
            loginError.style.display = 'none';
            formLogin.reset();
            
        } catch (error) {
            let loginError = document.getElementById('login-error');
            loginError.style.display = 'block';
            loginError.innerText = "Error: Invalid Credentials.";
        }
    });
}

let btnLogout = document.getElementById('btn-logout');

if (btnLogout) {
    btnLogout.addEventListener('click', function() {
        signOut(auth);
    });
}

let tabsArray = [
    'dashboard', 
    'transactions', 
    'analytics', 
    'sales', 
    'purchases', 
    'inventory', 
    'settings'
];

for (let i = 0; i < tabsArray.length; i++) {
    let currentTabName = tabsArray[i];
    let buttonElementId = `btn-${currentTabName}`;
    let buttonElement = document.getElementById(buttonElementId);
    
    if (buttonElement) {
        buttonElement.addEventListener('click', function() {
            
            for (let j = 0; j < tabsArray.length; j++) {
                let iterTabName = tabsArray[j];
                let tabElementId = `tab-${iterTabName}`;
                let iterButtonElementId = `btn-${iterTabName}`;
                
                let tabElement = document.getElementById(tabElementId);
                let iterButtonElement = document.getElementById(iterButtonElementId);
                
                if (tabElement) {
                    tabElement.classList.remove('active');
                }
                
                if (iterButtonElement) {
                    iterButtonElement.classList.remove('active');
                }
            }
            
            let targetTabElement = document.getElementById(`tab-${currentTabName}`);
            let targetButtonElement = document.getElementById(`btn-${currentTabName}`);
            
            targetTabElement.classList.add('active');
            targetButtonElement.classList.add('active');
            
            if (currentTabName === 'analytics') {
                setTimeout(function() {
                    runAnalytics();
                }, 50);
            }
        });
    }
}

let globalYearFilterDropdown = document.getElementById('global-year-filter');

if (globalYearFilterDropdown) {
    globalYearFilterDropdown.addEventListener('change', function(event) {
        let selectedValue = event.target.value;
        globalYearFilter = selectedValue;
        
        let dashYearLabel = document.getElementById('dash-year-label');
        if (dashYearLabel) {
            if (globalYearFilter === 'All') {
                dashYearLabel.innerText = `(All Years)`;
            } else {
                dashYearLabel.innerText = `(${globalYearFilter})`;
            }
        }
        
        updateDashboardMetrics();
        renderTransactionsTable();
        renderDashboardTopItems();
        
        let tabAnalytics = document.getElementById('tab-analytics');
        if (tabAnalytics.classList.contains('active')) {
            runAnalytics();
        }
    });
}

function startDatabaseListeners() {
    let customersCollection = collection(db, "customers");
    unsubCustomers = onSnapshot(customersCollection, function(snapshot) {
        let tempCustomers = [];
        snapshot.forEach(function(documentSnapshot) {
            let docData = documentSnapshot.data();
            docData.id = documentSnapshot.id;
            tempCustomers.push(docData);
        });
        allCustomers = tempCustomers;
    });

    let suppliersCollection = collection(db, "suppliers");
    unsubSuppliers = onSnapshot(suppliersCollection, function(snapshot) {
        let tempSuppliers = [];
        snapshot.forEach(function(documentSnapshot) {
            let docData = documentSnapshot.data();
            docData.id = documentSnapshot.id;
            tempSuppliers.push(docData);
        });
        allSuppliers = tempSuppliers;
    });

    let inventoryCollection = collection(db, "inventory");
    unsubInventory = onSnapshot(inventoryCollection, function(snapshot) {
        let tempInventory = [];
        snapshot.forEach(function(documentSnapshot) {
            let docData = documentSnapshot.data();
            docData.id = documentSnapshot.id;
            tempInventory.push(docData);
        });
        allInventory = tempInventory;
        
        updateInventoryStats();
        renderInventoryTable();
        updateDashboardMetrics();
    });

    let transactionsCollection = collection(db, "transactions");
    let transactionsQuery = query(transactionsCollection, orderBy("date", "desc"));
    
    unsubTransactions = onSnapshot(transactionsQuery, function(snapshot) {
        let tempTransactions = [];
        snapshot.forEach(function(documentSnapshot) {
            let docData = documentSnapshot.data();
            docData.id = documentSnapshot.id;
            tempTransactions.push(docData);
        });
        allTransactions = tempTransactions;
        
        updateYearDropdown(allTransactions);
        renderTransactionsTable();
        updateDashboardMonths(allTransactions);
        renderDashboardTopItems();
        updateDashboardMetrics();
    });
}

function stopDatabaseListeners() {
    if (unsubInventory !== null) {
        unsubInventory();
    }
    if (unsubTransactions !== null) {
        unsubTransactions();
    }
    if (unsubCustomers !== null) {
        unsubCustomers();
    }
    if (unsubSuppliers !== null) {
        unsubSuppliers();
    }
}

function initERPGrid() {
    let gstMasterCheckbox = document.getElementById('pur-gst-master');
    let gstinInput = document.getElementById('pur-gstin');
    let supplierDropdown = document.getElementById('pur-supplier');
    let purchaseTable = document.getElementById('pur-table');
    
    let purchaseTbody = document.getElementById('pur-tbody');
    purchaseTbody.innerHTML = '';
    
    addPurRow();

    if (gstMasterCheckbox) {
        gstMasterCheckbox.addEventListener('change', function() {
            runPurGridComputations();
        });
    }
    
    if (gstinInput) {
        gstinInput.addEventListener('input', function() {
            let rawValue = gstinInput.value;
            if (!rawValue) {
                rawValue = "";
            }
            
            let trimmedValue = rawValue.trim();
            let upperValue = trimmedValue.toUpperCase();
            gstinInput.value = upperValue;
            
            let indicatorElement = document.getElementById('pur-gstin-status');
            if (indicatorElement) {
                if (upperValue.length >= 2) {
                    indicatorElement.innerHTML = '<i class="fa-solid fa-check text-success"></i>';
                } else {
                    indicatorElement.innerHTML = '<i class="fa-solid fa-id-card"></i>';
                }
            }
            
            let supplyBadge = document.getElementById('pur-supply-badge');
            if (supplyBadge) {
                if (upperValue.length >= 2) {
                    supplyBadge.classList.remove('hidden');
                    supplyBadge.classList.remove('bg-warning/20');
                    supplyBadge.classList.remove('text-warning');
                    supplyBadge.classList.remove('border-warning');
                    
                    let statePrefix = upperValue.substring(0, 2);
                    
                    if (statePrefix === LOCAL_STATE_CODE) {
                        supplyBadge.innerText = 'Intra-State Supply (CGST+SGST)';
                        supplyBadge.className = "text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 block w-max";
                        
                        let interGroups = document.querySelectorAll('.group-inter');
                        for (let i = 0; i < interGroups.length; i++) {
                            interGroups[i].classList.add('hidden');
                        }
                        
                        let localGroups = document.querySelectorAll('.group-local');
                        for (let j = 0; j < localGroups.length; j++) {
                            localGroups[j].classList.remove('hidden');
                        }
                        
                    } else {
                        supplyBadge.innerText = 'Inter-State Supply (IGST)';
                        supplyBadge.className = "text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-purple-400 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 block w-max";
                        
                        let interGroups = document.querySelectorAll('.group-inter');
                        for (let k = 0; k < interGroups.length; k++) {
                            interGroups[k].classList.remove('hidden');
                        }
                        
                        let localGroups = document.querySelectorAll('.group-local');
                        for (let m = 0; m < localGroups.length; m++) {
                            localGroups[m].classList.add('hidden');
                        }
                    }
                } else {
                    supplyBadge.classList.add('hidden');
                }
            }
            
            runPurGridComputations();
        });
    }

    let purInvInput = document.getElementById('pur-inv');
    if (purInvInput) {
        purInvInput.addEventListener('input', function(event) {
            let inputValue = event.target.value;
            let upperInput = inputValue.toUpperCase();
            let trimmedInput = upperInput.trim();
            event.target.value = trimmedInput;
            
            let doesExist = false;
            for (let i = 0; i < allTransactions.length; i++) {
                let transaction = allTransactions[i];
                if (transaction.type === 'Purchase') {
                    if (transaction.invoice) {
                        let transactionInvoiceUpper = transaction.invoice.toUpperCase();
                        if (transactionInvoiceUpper === trimmedInput) {
                            doesExist = true;
                            break;
                        }
                    }
                }
            }
            
            let warningElement = document.getElementById('pur-inv-warning');
            if (warningElement) {
                if (doesExist) {
                    warningElement.style.display = 'flex';
                } else {
                    warningElement.style.display = 'none';
                }
            }
        });
    }

    let purManualOverride = document.getElementById('pur-manual-override');
    if (purManualOverride) {
        purManualOverride.addEventListener('change', function(event) {
            let isManualChecked = event.target.checked;
            
            let readOnlyFields = document.querySelectorAll('.row-taxable, .row-taxval, .row-total');
            for (let i = 0; i < readOnlyFields.length; i++) {
                let field = readOnlyFields[i];
                if (isManualChecked) {
                    field.readOnly = false;
                } else {
                    field.readOnly = true;
                }
            }
            
            if (isManualChecked === false) {
                runPurGridComputations();
            }
        });
    }
    
    if (purchaseTable) {
        purchaseTable.addEventListener('keydown', function(event) {
            let pressedKey = event.key;
            if (pressedKey === "Enter") {
                event.preventDefault();
                
                let isCtrlPressed = event.ctrlKey;
                if (isCtrlPressed) {
                    addPurRow();
                    return;
                }

                let allInputsNodeList = purchaseTable.querySelectorAll('input:not([disabled]):not([readonly])');
                let allInputsArray = Array.from(allInputsNodeList);
                let activeElement = document.activeElement;
                let currentIndex = allInputsArray.indexOf(activeElement);
                
                if (currentIndex > -1) {
                    let isShiftPressed = event.shiftKey;
                    if (isShiftPressed) {
                        if (currentIndex > 0) {
                            let previousInput = allInputsArray[currentIndex - 1];
                            previousInput.focus();
                        }
                    } else {
                        let lastIndex = allInputsArray.length - 1;
                        if (currentIndex < lastIndex) {
                            let nextInput = allInputsArray[currentIndex + 1];
                            nextInput.focus();
                        } else {
                            addPurRow();
                        }
                    }
                }
            }
        });

        purchaseTable.addEventListener('input', function(event) {
            let targetElement = event.target;
            let isQty = targetElement.classList.contains('row-qty');
            let isRate = targetElement.classList.contains('row-rate');
            let isGst = targetElement.classList.contains('row-gstp');
            
            if (isQty || isRate || isGst) {
                runPurGridComputations();
            }
        });

        purchaseTable.addEventListener('click', function(event) {
            let targetElement = event.target;
            let deleteButton = targetElement.closest('.btn-del-row');
            
            if (deleteButton) {
                let parentRow = deleteButton.closest('.pur-row');
                parentRow.remove();
                
                let remainingRows = document.querySelectorAll('.pur-row');
                if (remainingRows.length === 0) {
                    addPurRow();
                }
                
                let indexColumns = document.querySelectorAll('.idx-col');
                let indexArray = Array.from(indexColumns);
                for (let i = 0; i < indexArray.length; i++) {
                    let column = indexArray[i];
                    column.innerText = i + 1;
                }
                
                runPurGridComputations();
            }
        });
    }

    let btnPurReset = document.getElementById('btn-pur-reset');
    if (btnPurReset) {
        btnPurReset.addEventListener('click', function() {
            resetERP();
        });
    }
    
    let btnPurSave = document.getElementById('btn-pur-save');
    if (btnPurSave) {
        btnPurSave.addEventListener('click', function() {
            handleERPTransactionCommit(false);
        });
    }
    
    let btnPurSavePrint = document.getElementById('btn-pur-saveprint');
    if (btnPurSavePrint) {
        btnPurSavePrint.addEventListener('click', function() {
            handleERPTransactionCommit(true);
        });
    }
    
    setupERPMasterPredictiveInputs();
}

function addPurRow() {
    let tbodyElement = document.getElementById('pur-tbody');
    let overrideCheckbox = document.getElementById('pur-manual-override');
    let isManualFlag = false;
    
    if (overrideCheckbox) {
        isManualFlag = overrideCheckbox.checked;
    }
    
    let currentRowsNodeList = document.querySelectorAll('.pur-row');
    let currentRowsCount = currentRowsNodeList.length;
    let nextRowIndex = currentRowsCount + 1;
    
    let rowObject = document.createElement('tr');
    rowObject.className = "pur-row transition-colors relative hover:bg-gray-50/50 dark:hover:bg-gray-800/80";
    
    let readOnlyAttribute = "";
    if (isManualFlag === false) {
        readOnlyAttribute = "readonly";
    }
    
    let innerHtmlString = `
        <td class="text-center text-[11px] font-bold text-gray-500 align-middle idx-col">${nextRowIndex}</td>
        <td class="relative">
            <input type="text" class="erp-input w-full row-item bg-transparent font-medium" placeholder="Start typing item..." autocomplete="off">
            <div class="row-dropdown hidden absolute z-[70] top-full mt-0.5 left-0 w-[300px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-xl text-sm max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 custom-scrollbar"></div>
        </td>
        <td><input type="text" class="erp-input w-full text-center row-hsn text-[12px] font-semibold" placeholder="--"></td>
        <td><input type="number" step="0.001" class="erp-input w-full text-right row-qty text-[13px] text-gray-900 dark:text-gray-100 font-bold font-mono placeholder:font-sans placeholder-gray-300 bg-blue-50/20" placeholder="0"></td>
        <td><input type="text" class="erp-input w-full text-center row-unit text-[11px]" value="PCS" placeholder="PCS"></td>
        <td><input type="number" step="0.01" class="erp-input w-full text-right row-rate text-[13px] font-mono text-success placeholder-gray-300 font-bold bg-green-50/20" placeholder="0.00" min="0"></td>
        <td class="pur-gst-col transition-all"><input type="number" step="1" class="erp-input w-full text-center row-gstp font-bold font-mono text-purple-700 bg-purple-50/20" placeholder="18" value="18"></td>
        <td><input type="text" ${readOnlyAttribute} class="erp-input w-full text-right font-bold text-gray-500 font-mono bg-gray-50/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 row-taxable"></td>
        <td class="pur-gst-col transition-all"><input type="text" ${readOnlyAttribute} class="erp-input w-full text-right font-bold font-mono text-gray-400 bg-gray-50/80 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 row-taxval"></td>
        <td><input type="text" ${readOnlyAttribute} class="erp-input w-full text-right font-bold font-mono text-danger bg-red-50/40 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 row-total"></td>
        <td class="text-center align-middle border-l dark:border-gray-700">
            <button type="button" class="btn-del-row text-gray-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/30 h-6 w-6 rounded text-xs transition-colors"><i class="fa-solid fa-xmark"></i></button>
        </td>
    `;
    
    rowObject.innerHTML = innerHtmlString;
    tbodyElement.appendChild(rowObject);
    
    let itemInputElement = rowObject.querySelector('.row-item');
    let dropdownNodeElement = rowObject.querySelector('.row-dropdown');
    
    itemInputElement.addEventListener('focus', function() {
        renderItemDropdown(itemInputElement, dropdownNodeElement, rowObject);
    });
    
    itemInputElement.addEventListener('input', function() {
        renderItemDropdown(itemInputElement, dropdownNodeElement, rowObject);
    });
    
    itemInputElement.addEventListener('blur', function() {
        setTimeout(function() {
            dropdownNodeElement.classList.add('hidden');
        }, 200);
    });

    itemInputElement.focus();
    runPurGridComputations();
}

function runPurGridComputations() {
    let overrideCheckboxElement = document.getElementById('pur-manual-override');
    let isManualModeActive = false;
    if (overrideCheckboxElement) {
        isManualModeActive = overrideCheckboxElement.checked;
    }
    
    let gstMasterCheckboxElement = document.getElementById('pur-gst-master');
    let isMasterGstActive = false;
    if (gstMasterCheckboxElement) {
        isMasterGstActive = gstMasterCheckboxElement.checked;
    }
    
    let gstinInputElement = document.getElementById('pur-gstin');
    let gstinRawValue = "";
    if (gstinInputElement) {
        gstinRawValue = gstinInputElement.value;
    }
    
    let gstinStringValue = String(gstinRawValue);
    let gstinTrimmedValue = gstinStringValue.trim();
    
    let statePrefixString = gstinTrimmedValue.substring(0, 2);
    let isLocalSupply = false;
    
    if (statePrefixString === LOCAL_STATE_CODE) {
        isLocalSupply = true;
    } else if (gstinTrimmedValue === "") {
        isLocalSupply = true;
    }

    let totalTaxableAccumulator = 0;
    let totalTaxAccumulator = 0;
    let grandTotalAccumulator = 0;
    let stateGstAccumulator = 0;
    let centralGstAccumulator = 0;
    let integratedGstAccumulator = 0;
    
    let allGstColumns = document.querySelectorAll('.pur-gst-col');
    for (let i = 0; i < allGstColumns.length; i++) {
        let columnElement = allGstColumns[i];
        if (isMasterGstActive === false) {
            columnElement.classList.add('opacity-40');
            columnElement.classList.add('pointer-events-none');
            columnElement.classList.add('grayscale');
        } else {
            columnElement.classList.remove('opacity-40');
            columnElement.classList.remove('pointer-events-none');
            columnElement.classList.remove('grayscale');
        }
    }

    let allPurchaseRows = document.querySelectorAll('.pur-row');
    
    for (let j = 0; j < allPurchaseRows.length; j++) {
        let currentRowElement = allPurchaseRows[j];
        
        let qtyInputElement = currentRowElement.querySelector('.row-qty');
        let qtyRawValue = qtyInputElement.value;
        let qtyFloatValue = parseFloat(qtyRawValue);
        if (isNaN(qtyFloatValue)) {
            qtyFloatValue = 0;
        }
        
        let rateInputElement = currentRowElement.querySelector('.row-rate');
        let rateRawValue = rateInputElement.value;
        let rateFloatValue = parseFloat(rateRawValue);
        if (isNaN(rateFloatValue)) {
            rateFloatValue = 0;
        }
        
        let rowTaxableValue = qtyFloatValue * rateFloatValue;
        
        let gstPercentageInputElement = currentRowElement.querySelector('.row-gstp');
        let gstPercentageRawValue = gstPercentageInputElement.value;
        let gstPercentageFloatValue = parseFloat(gstPercentageRawValue);
        if (isNaN(gstPercentageFloatValue)) {
            gstPercentageFloatValue = 0;
        }

        let currentRowTaxAmount = 0;
        if (isMasterGstActive === true) {
            let taxMultiplier = gstPercentageFloatValue / 100;
            currentRowTaxAmount = rowTaxableValue * taxMultiplier;
        }

        let currentRowTotalAmount = rowTaxableValue + currentRowTaxAmount;

        let taxableTargetInput = currentRowElement.querySelector('.row-taxable');
        let taxValueTargetInput = currentRowElement.querySelector('.row-taxval');
        let totalTargetInput = currentRowElement.querySelector('.row-total');

        if (isManualModeActive === false) {
            if (rowTaxableValue > 0) {
                taxableTargetInput.value = rowTaxableValue.toFixed(2);
            } else {
                taxableTargetInput.value = "";
            }
            
            if (currentRowTaxAmount > 0) {
                taxValueTargetInput.value = currentRowTaxAmount.toFixed(2);
            } else {
                taxValueTargetInput.value = "";
            }
            
            if (currentRowTotalAmount > 0) {
                totalTargetInput.value = currentRowTotalAmount.toFixed(2);
            } else {
                totalTargetInput.value = "";
            }
        } else {
            let manualTaxableRaw = taxableTargetInput.value;
            let manualTaxableFloat = parseFloat(manualTaxableRaw);
            if (isNaN(manualTaxableFloat)) {
                manualTaxableFloat = 0;
            }
            rowTaxableValue = manualTaxableFloat;
            
            let manualTaxRaw = taxValueTargetInput.value;
            let manualTaxFloat = parseFloat(manualTaxRaw);
            if (isNaN(manualTaxFloat)) {
                manualTaxFloat = 0;
            }
            currentRowTaxAmount = manualTaxFloat;
            
            let manualTotalRaw = totalTargetInput.value;
            let manualTotalFloat = parseFloat(manualTotalRaw);
            if (isNaN(manualTotalFloat)) {
                manualTotalFloat = 0;
            }
            currentRowTotalAmount = manualTotalFloat;
        }

        totalTaxableAccumulator = totalTaxableAccumulator + rowTaxableValue;
        totalTaxAccumulator = totalTaxAccumulator + currentRowTaxAmount;

        if (isMasterGstActive === true) {
            if (isLocalSupply === true) {
                let halfTaxAmount = currentRowTaxAmount / 2;
                centralGstAccumulator = centralGstAccumulator + halfTaxAmount;
                stateGstAccumulator = stateGstAccumulator + halfTaxAmount;
            } else {
                integratedGstAccumulator = integratedGstAccumulator + currentRowTaxAmount;
            }
        }
        
        grandTotalAccumulator = grandTotalAccumulator + currentRowTotalAmount;
    }

    let preRoundCalculation = grandTotalAccumulator * 100;
    let roundedPreCalculation = Math.round(preRoundCalculation);
    let rawTotalsCalculation = roundedPreCalculation / 100;
    
    let finalRoundedGrandTotal = Math.round(rawTotalsCalculation);
    let roundOffDifferenceAmount = finalRoundedGrandTotal - rawTotalsCalculation;

    let targetTaxableDisplay = document.getElementById('pur-t-taxable');
    if (targetTaxableDisplay) {
        targetTaxableDisplay.innerText = "₹" + totalTaxableAccumulator.toFixed(2);
    }
    
    let targetCgstDisplay = document.getElementById('pur-t-cgst');
    if (targetCgstDisplay) {
        targetCgstDisplay.innerText = "₹" + centralGstAccumulator.toFixed(2);
    }
    
    let targetSgstDisplay = document.getElementById('pur-t-sgst');
    if (targetSgstDisplay) {
        targetSgstDisplay.innerText = "₹" + stateGstAccumulator.toFixed(2);
    }
    
    let targetIgstDisplay = document.getElementById('pur-t-igst');
    if (targetIgstDisplay) {
        targetIgstDisplay.innerText = "₹" + integratedGstAccumulator.toFixed(2);
    }
    
    let targetRoundDisplay = document.getElementById('pur-t-round');
    if (targetRoundDisplay) {
        let absRoundDifference = Math.abs(roundOffDifferenceAmount);
        let fixedRoundDifference = absRoundDifference.toFixed(2);
        
        if (roundOffDifferenceAmount >= 0) {
            targetRoundDisplay.innerText = "+ ₹" + fixedRoundDifference;
        } else {
            targetRoundDisplay.innerText = "- ₹" + fixedRoundDifference;
        }
    }
    
    let targetGrandTotalDisplay = document.getElementById('pur-t-grand');
    if (targetGrandTotalDisplay) {
        targetGrandTotalDisplay.innerText = "₹" + finalRoundedGrandTotal.toFixed(2);
    }
    
    let validationToastElement = document.getElementById('pur-validation-toast');
    if (validationToastElement) {
        validationToastElement.innerText = "Values synced instantly ✓";
        setTimeout(function() {
            validationToastElement.innerText = "";
        }, 1500);
    }
}

function renderItemDropdown(inputElement, dropdownElement, rowElement) {
    let rawInputValue = inputElement.value;
    if (!rawInputValue) {
        rawInputValue = "";
    }
    
    let stringInputValue = String(rawInputValue);
    let trimmedInputValue = stringInputValue.trim();
    let lowerInputValue = trimmedInputValue.toLowerCase();
    
    let matchedItemsArray = [];
    
    for (let i = 0; i < allInventory.length; i++) {
        let currentInventoryItem = allInventory[i];
        let inventoryItemName = currentInventoryItem.name;
        let stringItemName = String(inventoryItemName);
        let lowerItemName = stringItemName.toLowerCase();
        
        let doesInclude = lowerItemName.includes(lowerInputValue);
        if (doesInclude === true) {
            matchedItemsArray.push(currentInventoryItem);
        }
    }
    
    let matchesCount = matchedItemsArray.length;
    
    if (matchesCount === 0) {
        let noMatchHtml = `<div class="p-3 text-xs text-gray-500 italic text-center">Press Tab/Enter to input as newly discovered.</div>`;
        dropdownElement.innerHTML = noMatchHtml;
    } else {
        let generatedHtmlContent = "";
        
        let maxDisplayCount = 8;
        let currentDisplayCount = 0;
        
        for (let j = 0; j < matchedItemsArray.length; j++) {
            if (currentDisplayCount >= maxDisplayCount) {
                break;
            }
            
            let matchedItem = matchedItemsArray[j];
            
            let itemName = matchedItem.name;
            if (!itemName) {
                itemName = "";
            }
            
            let itemPrice = matchedItem.price;
            if (!itemPrice) {
                itemPrice = 0;
            }
            
            let itemGstFlag = matchedItem.hasGST;
            let itemGstString = "0";
            if (itemGstFlag === true) {
                itemGstString = "18";
            }
            
            let itemHsn = matchedItem.hsn;
            if (!itemHsn) {
                itemHsn = "";
            }
            
            let itemPartNumber = matchedItem.partNumber;
            let itemPartString = "";
            if (itemPartNumber) {
                itemPartString = "PN: " + itemPartNumber;
            }
            
            let itemQty = matchedItem.qty;
            if (!itemQty) {
                itemQty = 0;
            }
            
            let itemHtmlBlock = `
                <div class="p-2 cursor-pointer text-sm text-gray-800 dark:text-gray-100 dropdown-item-hover transition-colors font-medium select-pur-item-grid-sys border-b border-gray-100 dark:border-gray-700/40" 
                    data-n="${itemName}" 
                    data-p="${itemPrice}" 
                    data-g="${itemGstString}" 
                    data-hs="${itemHsn}">
                    
                    ${itemName} 
                    <span class="float-right text-xs font-mono font-normal text-success">LPC: ₹${itemPrice}</span>
                    <div class="text-[10px] text-gray-400 mt-0.5">${itemPartString} Stk: ${itemQty}</div>
                </div>
            `;
            
            generatedHtmlContent = generatedHtmlContent + itemHtmlBlock;
            currentDisplayCount++;
        }
        
        dropdownElement.innerHTML = generatedHtmlContent;
        
        let allDropdownButtons = dropdownElement.querySelectorAll('.select-pur-item-grid-sys');
        
        for (let k = 0; k < allDropdownButtons.length; k++) {
            let dropdownButton = allDropdownButtons[k];
            
            dropdownButton.addEventListener('mousedown', function(event) {
                event.preventDefault();
                
                let clickedName = this.getAttribute('data-n');
                let clickedPrice = this.getAttribute('data-p');
                let clickedGst = this.getAttribute('data-g');
                let clickedHsn = this.getAttribute('data-hs');
                
                inputElement.value = clickedName;
                
                let targetRateInput = rowElement.querySelector('.row-rate');
                let parsedPrice = parseFloat(clickedPrice);
                
                if (parsedPrice > 0) {
                    targetRateInput.value = clickedPrice;
                } else {
                    targetRateInput.value = "";
                }
                
                let targetGstInput = rowElement.querySelector('.row-gstp');
                if (clickedGst) {
                    targetGstInput.value = clickedGst;
                } else {
                    targetGstInput.value = "18";
                }
                
                let targetHsnInput = rowElement.querySelector('.row-hsn');
                if (clickedHsn) {
                    targetHsnInput.value = clickedHsn;
                } else {
                    targetHsnInput.value = "";
                }
                
                let currentRateValue = targetRateInput.value;
                renderAssistant(clickedName, currentRateValue, rowElement);
                
                let targetQtyInput = rowElement.querySelector('.row-qty');
                targetQtyInput.focus();
                
                dropdownElement.classList.add('hidden');
                runPurGridComputations();
            });
        }
    }
    
    dropdownElement.classList.remove('hidden');
    
    let activeRateInput = rowElement.querySelector('.row-rate');
    let activeRateValue = activeRateInput.value;
    
    renderAssistant(lowerInputValue, activeRateValue, rowElement);
}

function renderAssistant(itemNameString, itemRateString, tableRowElement) {
    let assistantBoxElement = document.getElementById('pur-smart-assistant');
    if (!assistantBoxElement) {
        return;
    }
    
    let stringItemName = String(itemNameString);
    let lowerItemName = stringItemName.toLowerCase();
    let trimmedItemName = lowerItemName.trim();
    
    let existingInventoryItem = null;
    
    for (let i = 0; i < allInventory.length; i++) {
        let currentItem = allInventory[i];
        let currentItemName = currentItem.name;
        let stringCurrentName = String(currentItemName);
        let lowerCurrentName = stringCurrentName.toLowerCase();
        let trimmedCurrentName = lowerCurrentName.trim();
        
        if (trimmedCurrentName === trimmedItemName) {
            existingInventoryItem = currentItem;
            break;
        }
    }
    
    if (existingInventoryItem === null) {
        let newSkuHtml = `
            <h4 class="text-[10px] font-bold uppercase text-gray-500 absolute top-2 left-3 tracking-widest">
                <i class="fa-solid fa-seedling mr-1"></i> Line Assisstant
            </h4>
            <div class="mt-4 flex flex-col gap-1">
                <p class="text-sm text-gray-800 dark:text-gray-100 font-medium">New SKU entry tracking initiated.</p>
                <p class="text-[10px] text-gray-500">System will securely establish internal ledger references when transaction is committed.</p>
            </div>
        `;
        assistantBoxElement.innerHTML = newSkuHtml;
    } else {
        let differencePercentage = 0;
        let colorTagClass = 'text-warning';
        
        let lastPurchaseRate = existingInventoryItem.price;
        let currentPurchaseRate = parseFloat(itemRateString);
        if (isNaN(currentPurchaseRate)) {
            currentPurchaseRate = 0;
        }
        
        let trendString = '<i class="fa-solid fa-minus text-gray-400"></i> No Rate variance detected from Historical LPC Ledger data.';
        
        let isLastRateValid = lastPurchaseRate > 0;
        let isCurrentRateValid = currentPurchaseRate > 0;
        
        if (isLastRateValid === true) {
            if (isCurrentRateValid === true) {
                let rateDifference = currentPurchaseRate - lastPurchaseRate;
                let rateRatio = rateDifference / lastPurchaseRate;
                let percentageValue = rateRatio * 100;
                
                differencePercentage = percentageValue;
                
                if (differencePercentage > 0.5) {
                    let fixedPercentage = differencePercentage.toFixed(1);
                    trendString = `<i class="fa-solid fa-arrow-trend-up text-danger mr-1 animate-pulse"></i> Attention: Unit acquisition rate spiked <b>${fixedPercentage}%</b> over recent LPC marker.`;
                    colorTagClass = 'text-danger';
                } else if (differencePercentage < -0.5) {
                    trendString = `<i class="fa-solid fa-arrow-trend-down text-success mr-1"></i> Efficiency tracking logic logs drop yielding cost reduction!`;
                    colorTagClass = 'text-success';
                }
            }
        }

        let existingItemName = existingInventoryItem.name;
        let existingItemPrice = existingInventoryItem.price;
        let parsedExistingPrice = parseFloat(existingItemPrice);
        let fixedExistingPrice = parsedExistingPrice.toFixed(2);

        let liveDbHtml = `
            <h4 class="text-[10px] font-bold uppercase text-indigo-400 absolute top-2 left-3 tracking-widest">
                <i class="fa-solid fa-database mr-1 text-primary"></i> Live Tnx DB
            </h4>
            <div class="mt-4 w-full">
                <div class="flex justify-between items-center text-xs border-b border-indigo-200/50 dark:border-indigo-800/40 pb-2">
                    <span class="text-gray-500 font-bold truncate pr-4 max-w-[200px]" title="${existingItemName}">${existingItemName}</span>
                    <span class="font-mono text-gray-800 dark:text-gray-100 whitespace-nowrap bg-indigo-100/50 dark:bg-indigo-900/30 px-2 rounded tracking-tight text-right text-success">LPC Base ₹${fixedExistingPrice}</span>
                </div>
                <div class="mt-2 text-[10px] ${colorTagClass} flex gap-1 items-start leading-tight">
                    <p class="pt-0.5 w-full">${trendString}</p>
                </div>
            </div>
        `;
        assistantBoxElement.innerHTML = liveDbHtml;
    }
}

function setupERPMasterPredictiveInputs() {
    let inputSupplierElement = document.getElementById('pur-supplier');
    let dropdownSupplierElement = document.getElementById('pur-supplier-dropdown');
    
    if (!inputSupplierElement) {
        return;
    }
    if (!dropdownSupplierElement) {
        return;
    }
    
    inputSupplierElement.addEventListener('focus', renderSupplierDropdown);
    inputSupplierElement.addEventListener('input', renderSupplierDropdown);
    
    inputSupplierElement.addEventListener('blur', function() {
        setTimeout(function() {
            dropdownSupplierElement.classList.add('hidden');
        }, 200);
    });

    function renderSupplierDropdown() {
        let rawInputValue = inputSupplierElement.value;
        let stringInputValue = String(rawInputValue);
        let trimmedInputValue = stringInputValue.trim();
        let lowerInputValue = trimmedInputValue.toLowerCase();
        
        let matchedSuppliersArray = [];
        
        for (let i = 0; i < allSuppliers.length; i++) {
            let currentSupplier = allSuppliers[i];
            let supplierName = currentSupplier.name;
            if (!supplierName) {
                supplierName = "";
            }
            
            let supplierGstin = currentSupplier.gstin;
            if (!supplierGstin) {
                supplierGstin = "";
            }
            
            let stringSupplierName = String(supplierName);
            let lowerSupplierName = stringSupplierName.toLowerCase();
            
            let stringSupplierGstin = String(supplierGstin);
            let lowerSupplierGstin = stringSupplierGstin.toLowerCase();
            
            let doesNameInclude = lowerSupplierName.includes(lowerInputValue);
            let doesGstinInclude = lowerSupplierGstin.includes(lowerInputValue);
            
            if (doesNameInclude === true) {
                matchedSuppliersArray.push(currentSupplier);
            } else if (doesGstinInclude === true) {
                matchedSuppliersArray.push(currentSupplier);
            }
        }
        
        let htmlContentString = "";
        let matchesCount = matchedSuppliersArray.length;
        let isCashQuery = lowerInputValue === 'cash';
        
        if (matchesCount === 0) {
            if (isCashQuery === false) {
                let noMatchWarningHtml = `
                    <div class="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 font-semibold text-[11px]">
                        <i class="fa-solid fa-asterisk"></i> Unknown Supplier. Will be created automatically on save.
                    </div>
                `;
                htmlContentString = noMatchWarningHtml;
            }
        } else {
            for (let j = 0; j < matchedSuppliersArray.length; j++) {
                let matchedSupplier = matchedSuppliersArray[j];
                let supplierNameOutput = matchedSupplier.name;
                if (!supplierNameOutput) {
                    supplierNameOutput = "";
                }
                
                let supplierGstinOutput = matchedSupplier.gstin;
                if (!supplierGstinOutput) {
                    supplierGstinOutput = "";
                }
                
                let badgeHtmlString = "";
                if (supplierGstinOutput !== "") {
                    badgeHtmlString = `
                        <span class="text-[9px] uppercase px-1.5 rounded-sm border bg-gray-100 dark:bg-gray-800 tracking-wider font-mono">
                            <i class="fa-regular fa-id-badge text-gray-400"></i> ${supplierGstinOutput}
                        </span>
                    `;
                } else {
                    badgeHtmlString = `<i class="fa-solid fa-street-view text-gray-300"></i>`;
                }
                
                let supplierRowHtml = `
                    <div class="px-3 py-2 cursor-pointer dropdown-item-hover pur-sup-select-action text-sm transition-colors border-b dark:border-gray-700/50 last:border-0 font-medium text-gray-800 dark:text-gray-100 flex items-center justify-between" 
                        data-s="${supplierNameOutput}" 
                        data-g="${supplierGstinOutput}">
                        <span>${supplierNameOutput}</span>
                        ${badgeHtmlString}
                    </div>
                `;
                htmlContentString = htmlContentString + supplierRowHtml;
            }
        }
        
        dropdownSupplierElement.innerHTML = htmlContentString;
        dropdownSupplierElement.classList.remove('hidden');
        
        let allDropdownButtons = dropdownSupplierElement.querySelectorAll('.pur-sup-select-action');
        
        for (let k = 0; k < allDropdownButtons.length; k++) {
            let currentButton = allDropdownButtons[k];
            
            currentButton.addEventListener('mousedown', function(event) {
                event.preventDefault();
                
                let dataSupplierName = this.getAttribute('data-s');
                let dataSupplierGstin = this.getAttribute('data-g');
                
                inputSupplierElement.value = dataSupplierName;
                
                let targetGstinInput = document.getElementById('pur-gstin');
                targetGstinInput.value = dataSupplierGstin;
                
                let inputEvent = new Event('input');
                targetGstinInput.dispatchEvent(inputEvent);
                
                dropdownSupplierElement.classList.add('hidden');
            });
        }
    }
}

function resetERP() {
    let purDateInput = document.getElementById('pur-date');
    if (purDateInput) {
        purDateInput.value = todayStr;
    }
    
    let purInvInput = document.getElementById('pur-inv');
    if (purInvInput) {
        purInvInput.value = "";
    }
    
    let purInvWarning = document.getElementById('pur-inv-warning');
    if (purInvWarning) {
        purInvWarning.style.display = 'none';
    }
    
    let purSupplierInput = document.getElementById('pur-supplier');
    if (purSupplierInput) {
        purSupplierInput.value = "";
    }
    
    let purGstinInput = document.getElementById('pur-gstin');
    if (purGstinInput) {
        purGstinInput.value = "";
        let inputEvent = new Event('input');
        purGstinInput.dispatchEvent(inputEvent);
    }
    
    let purTbody = document.getElementById('pur-tbody');
    if (purTbody) {
        purTbody.innerHTML = "";
    }
    
    addPurRow();
    runPurGridComputations();
    
    let scrollOptions = {
        top: 0,
        behavior: 'smooth'
    };
    window.scrollTo(scrollOptions);
}

async function handleERPTransactionCommit(shouldPrintFlag) {
    let purDateElement = document.getElementById('pur-date');
    let purchaseDateString = purDateElement.value;
    
    let purInvElement = document.getElementById('pur-inv');
    let rawInvString = purInvElement.value;
    let trimmedInvString = rawInvString.trim();
    let upperInvString = trimmedInvString.toUpperCase();
    
    let finalInvoiceNumber = upperInvString;
    if (!finalInvoiceNumber) {
        finalInvoiceNumber = "MANUAL-ERR-SKIPPED";
    }
    
    let purSupplierElement = document.getElementById('pur-supplier');
    let rawSupplierString = purSupplierElement.value;
    let finalSupplierString = rawSupplierString.trim();
    
    let purGstinElement = document.getElementById('pur-gstin');
    let rawGstinString = purGstinElement.value;
    let trimmedGstinString = rawGstinString.trim();
    let finalGstinString = trimmedGstinString.toUpperCase();

    if (!finalSupplierString) {
        alert("ERROR - Please provide a supplier name to save the purchase.");
        purSupplierElement.focus();
        return;
    }
    
    let gstMasterElement = document.getElementById('pur-gst-master');
    let isMasterGstChecked = false;
    if (gstMasterElement) {
        isMasterGstChecked = gstMasterElement.checked;
    }
    
    let allPurchaseRows = document.querySelectorAll('.pur-row');

    let saveButtonElement = document.getElementById('btn-pur-save');
    let originalButtonHtml = saveButtonElement.innerHTML;

    let processingHtml = `<i class="fa-solid fa-arrows-spin fa-spin fa-fw"></i> COMMITTING...`;
    saveButtonElement.innerHTML = processingHtml;
    saveButtonElement.disabled = true;

    try {
        let databaseBatch = writeBatch(db);

        for (let i = 0; i < allPurchaseRows.length; i++) {
            let currentRow = allPurchaseRows[i];
            
            let itemInputElement = currentRow.querySelector('.row-item');
            let rawItemString = itemInputElement.value;
            let finalItemString = rawItemString.trim();
            
            if (!finalItemString) {
                continue;
            }
            
            let qtyInputElement = currentRow.querySelector('.row-qty');
            let rawQtyString = qtyInputElement.value;
            let finalQtyFloat = parseFloat(rawQtyString);
            if (isNaN(finalQtyFloat)) {
                finalQtyFloat = 0;
            }
            
            let rateInputElement = currentRow.querySelector('.row-rate');
            let rawRateString = rateInputElement.value;
            let finalRateFloat = parseFloat(rawRateString);
            if (isNaN(finalRateFloat)) {
                finalRateFloat = 0;
            }

            if (finalQtyFloat === 0) {
                continue;
            }
            
            let statePrefixSubstring = finalGstinString.substring(0, 2);
            if (!statePrefixSubstring) {
                statePrefixSubstring = "";
            }
            
            let isLocalTransaction = false;
            if (statePrefixSubstring === LOCAL_STATE_CODE) {
                isLocalTransaction = true;
            } else if (statePrefixSubstring === "") {
                isLocalTransaction = true;
            }
            
            let taxableInputElement = currentRow.querySelector('.row-taxable');
            let rawTaxableString = taxableInputElement.value;
            let parsedTaxableFloat = parseFloat(rawTaxableString);
            
            let finalTaxableFloat = 0;
            if (!isNaN(parsedTaxableFloat)) {
                finalTaxableFloat = parsedTaxableFloat;
            } else {
                finalTaxableFloat = finalQtyFloat * finalRateFloat;
            }
            
            let taxValueInputElement = currentRow.querySelector('.row-taxval');
            let rawTaxValueString = taxValueInputElement.value;
            let parsedTaxValueFloat = parseFloat(rawTaxValueString);
            
            let finalTaxValueFloat = 0;
            if (!isNaN(parsedTaxValueFloat)) {
                finalTaxValueFloat = parsedTaxValueFloat;
            }
            
            let gstPercentageInputElement = currentRow.querySelector('.row-gstp');
            let rawGstPercentageString = gstPercentageInputElement.value;
            let parsedGstPercentageFloat = parseFloat(rawGstPercentageString);
            
            let finalGstPercentageFloat = 0;
            if (isMasterGstChecked === true) {
                if (!isNaN(parsedGstPercentageFloat)) {
                    finalGstPercentageFloat = parsedGstPercentageFloat;
                } else {
                    finalGstPercentageFloat = 18;
                }
            }
            
            let totalInputElement = currentRow.querySelector('.row-total');
            let rawTotalString = totalInputElement.value;
            let parsedTotalFloat = parseFloat(rawTotalString);
            
            let finalTotalAmountFloat = 0;
            if (!isNaN(parsedTotalFloat)) {
                finalTotalAmountFloat = parsedTotalFloat;
            } else {
                finalTotalAmountFloat = finalTaxableFloat + finalTaxValueFloat;
            }
            
            let transactionsCollectionReference = collection(db, "transactions");
            let newTransactionDocumentReference = doc(transactionsCollectionReference);
            
            let transactionDateObject = new Date(purchaseDateString + 'T12:00:00');
            let transactionIsoString = transactionDateObject.toISOString();
            
            let hsnInputElement = currentRow.querySelector('.row-hsn');
            let rawHsnString = hsnInputElement.value;
            let finalHsnString = "";
            if (rawHsnString) {
                finalHsnString = rawHsnString;
            }
            
            let cgstCalculatedValue = 0;
            let sgstCalculatedValue = 0;
            let igstCalculatedValue = 0;
            
            if (isMasterGstChecked === true) {
                if (isLocalTransaction === true) {
                    cgstCalculatedValue = finalTaxValueFloat / 2;
                    sgstCalculatedValue = finalTaxValueFloat / 2;
                } else {
                    igstCalculatedValue = finalTaxValueFloat;
                }
            }
            
            let transactionDataPayload = {
                type: "Purchase",
                item: finalItemString,
                qty: finalQtyFloat,
                rate: finalRateFloat,
                amount: finalTotalAmountFloat,
                taxable: finalTaxableFloat,
                date: transactionIsoString,
                hasGST: isMasterGstChecked,
                hsn: finalHsnString,
                cgst: cgstCalculatedValue,
                sgst: sgstCalculatedValue,
                igst: igstCalculatedValue,
                supplier: finalSupplierString,
                supplierGstin: finalGstinString,
                invoice: finalInvoiceNumber
            };
            
            databaseBatch.set(newTransactionDocumentReference, transactionDataPayload);

            let matchingInventoryItem = null;
            let lowerFinalItemString = finalItemString.toLowerCase();
            
            for (let j = 0; j < allInventory.length; j++) {
                let currentInvItem = allInventory[j];
                let currentInvName = currentInvItem.name;
                if (!currentInvName) {
                    currentInvName = "";
                }
                let stringCurrentInvName = String(currentInvName);
                let lowerCurrentInvName = stringCurrentInvName.toLowerCase();
                
                if (lowerCurrentInvName === lowerFinalItemString) {
                    matchingInventoryItem = currentInvItem;
                    break;
                }
            }
            
            if (matchingInventoryItem !== null) {
                let existingItemQty = matchingInventoryItem.qty;
                let parsedExistingQty = Number(existingItemQty);
                let finalExistingQty = 0;
                if (!isNaN(parsedExistingQty)) {
                    finalExistingQty = parsedExistingQty;
                }
                
                let existingItemPrice = matchingInventoryItem.price;
                let parsedExistingPrice = Number(existingItemPrice);
                let finalExistingPrice = 0;
                if (!isNaN(parsedExistingPrice)) {
                    finalExistingPrice = parsedExistingPrice;
                }
                
                let combinedTotalQty = finalExistingQty + finalQtyFloat;
                let calculatedNewAveragePrice = 0;
                
                if (combinedTotalQty > 0) {
                    let oldInventoryValue = finalExistingQty * finalExistingPrice;
                    let totalInventoryValue = oldInventoryValue + finalTaxableFloat;
                    calculatedNewAveragePrice = totalInventoryValue / combinedTotalQty;
                }
                
                let parsedNewAveragePrice = parseFloat(calculatedNewAveragePrice);
                
                let existingHsnString = matchingInventoryItem.hsn;
                if (!existingHsnString) {
                    existingHsnString = "";
                }
                
                let inventoryHsnUpdateString = "";
                if (finalHsnString !== "") {
                    inventoryHsnUpdateString = finalHsnString;
                } else if (existingHsnString !== "") {
                    inventoryHsnUpdateString = existingHsnString;
                }
                
                let inventoryDocumentReference = doc(db, "inventory", matchingInventoryItem.id);
                
                let inventoryUpdatePayload = {
                    qty: combinedTotalQty,
                    price: parsedNewAveragePrice,
                    hasGST: isMasterGstChecked,
                    hsn: inventoryHsnUpdateString
                };
                
                databaseBatch.update(inventoryDocumentReference, inventoryUpdatePayload);
                
            } else {
                let newInventoryCollectionReference = collection(db, "inventory");
                let newInventoryDocumentReference = doc(newInventoryCollectionReference);
                
                let newInventoryPayload = {
                    name: finalItemString,
                    qty: finalQtyFloat,
                    price: finalRateFloat,
                    hasGST: isMasterGstChecked,
                    hsn: finalHsnString
                };
                
                databaseBatch.set(newInventoryDocumentReference, newInventoryPayload);
            }
        }
        
        await databaseBatch.commit();

        let lowerFinalSupplierString = finalSupplierString.toLowerCase();
        let isNotCash = lowerFinalSupplierString !== "cash";
        let isNotEmpty = finalSupplierString !== "";
        
        if (isNotCash === true) {
            if (isNotEmpty === true) {
                
                let doesSupplierExist = false;
                
                for (let k = 0; k < allSuppliers.length; k++) {
                    let iteratedSupplier = allSuppliers[k];
                    let iteratedSupplierName = iteratedSupplier.name;
                    let stringIteratedName = String(iteratedSupplierName);
                    let lowerIteratedName = stringIteratedName.toLowerCase();
                    
                    if (lowerIteratedName === lowerFinalSupplierString) {
                        doesSupplierExist = true;
                        break;
                    }
                }
                
                if (doesSupplierExist === false) {
                    let suppliersCollectionReference = collection(db, "suppliers");
                    let currentTimestampDate = new Date();
                    let currentTimestampString = currentTimestampDate.toISOString();
                    
                    let newSupplierPayload = {
                        name: finalSupplierString,
                        gstin: finalGstinString,
                        createdAt: currentTimestampString
                    };
                    
                    await addDoc(suppliersCollectionReference, newSupplierPayload);
                }
            }
        }
        
        showSuccessAnimation("Transaction Saved Successfully!");
        resetERP();
        
    } catch (error) {
        let errorMessageString = error.message;
        let alertMessageString = "An internal logic system validation check hit during Database commit phases! Details appended in developer trace... (" + errorMessageString + ")";
        alert(alertMessageString);
    } finally {
        saveButtonElement.innerHTML = originalButtonHtml;
        saveButtonElement.disabled = false;
    }
}

function updateSaleCartUI() {
    let cartListElement = document.getElementById('cart-list');
    let cartTotalElement = document.getElementById('cart-total');
    let cartContainerElement = document.getElementById('cart-container');
    
    if (!cartListElement) {
        return;
    }
    if (!cartContainerElement) {
        return;
    }
    
    cartListElement.innerHTML = '';
    let totalCartAmountAccumulator = 0;
    
    let isCartEmpty = true;
    if (window.saleCart) {
        if (window.saleCart.length > 0) {
            isCartEmpty = false;
        }
    }
    
    if (isCartEmpty === true) {
        cartContainerElement.classList.add('hidden');
    } else {
        cartContainerElement.classList.remove('hidden');
        
        for (let i = 0; i < window.saleCart.length; i++) {
            let currentCartItem = window.saleCart[i];
            let currentItemAmount = currentCartItem.amount;
            
            totalCartAmountAccumulator = totalCartAmountAccumulator + currentItemAmount;
            
            let gstBadgeHtmlString = "";
            let itemHasGstFlag = currentCartItem.hasGST;
            if (itemHasGstFlag === true) {
                gstBadgeHtmlString = `<span class="bg-indigo-100 text-indigo-700 text-[10px] px-1 rounded ml-1 font-bold">GST</span>`;
            }
            
            let currentItemName = currentCartItem.item;
            let currentItemQty = currentCartItem.qty;
            let currentItemAmountNumber = Number(currentItemAmount);
            let currentItemAmountFixed = currentItemAmountNumber.toFixed(2);
            
            let cartItemHtmlString = `
                <li class="py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 flex flex-col gap-0.5">
                   <div class="flex justify-between items-center text-sm font-semibold text-gray-800 dark:text-gray-200">
                      <span>${currentItemName} ${gstBadgeHtmlString} <b class="text-primary">(x${currentItemQty})</b></span>
                      <span class="font-bold">₹${currentItemAmountFixed} <button onclick="window.removeSaleItem(${i})" class="text-danger ml-3 transition-colors active:scale-95"><i class="fa-solid fa-xmark"></i></button></span>
                   </div>
                </li>
            `;
            
            cartListElement.innerHTML = cartListElement.innerHTML + cartItemHtmlString;
        }
    }
    
    if (cartTotalElement) {
        let fixedTotalAmount = totalCartAmountAccumulator.toFixed(2);
        cartTotalElement.innerText = fixedTotalAmount;
    }
}

window.removeSaleItem = function(indexNumber) {
    window.saleCart.splice(indexNumber, 1);
    updateSaleCartUI();
};

let btnAddToCartElement = document.getElementById('btn-add-to-cart');
if (btnAddToCartElement) {
    btnAddToCartElement.addEventListener('click', function() {
        let saleItemInputElement = document.getElementById('sale-item');
        let rawSaleItemName = saleItemInputElement.value;
        let trimmedSaleItemName = rawSaleItemName.trim();
        
        let saleQtyInputElement = document.getElementById('sale-qty');
        let rawSaleQtyString = saleQtyInputElement.value;
        let parsedSaleQtyInt = parseInt(rawSaleQtyString);
        let finalSaleQtyInt = 0;
        if (!isNaN(parsedSaleQtyInt)) {
            finalSaleQtyInt = parsedSaleQtyInt;
        }
        
        let saleRateInputElement = document.getElementById('sale-rate');
        let rawSaleRateString = saleRateInputElement.value;
        let parsedSaleRateFloat = parseFloat(rawSaleRateString);
        let finalSaleRateFloat = 0;
        if (!isNaN(parsedSaleRateFloat)) {
            finalSaleRateFloat = parsedSaleRateFloat;
        }
        
        let isNameInvalid = trimmedSaleItemName === "";
        let isQtyInvalid = finalSaleQtyInt <= 0;
        let isRateInvalid = finalSaleRateFloat <= 0;
        
        if (isNameInvalid === true) {
            alert('Invalid Sales parameter. Please enter an item name.');
            return;
        }
        if (isQtyInvalid === true) {
            alert('Invalid Sales parameter. Please enter a valid quantity.');
            return;
        }
        if (isRateInvalid === true) {
            alert('Invalid Sales parameter. Please enter a valid rate.');
            return;
        }
        
        let saleGstCheckboxElement = document.getElementById('sale-gst');
        let isSaleGstChecked = saleGstCheckboxElement.checked;
        
        let calculatedSaleTaxableAmount = finalSaleQtyInt * finalSaleRateFloat;
        
        let saleHsnInputElement = document.getElementById('sale-hsn');
        let rawSaleHsnString = saleHsnInputElement.value;
        let finalSaleHsnString = "";
        if (rawSaleHsnString) {
            finalSaleHsnString = rawSaleHsnString;
        }
        
        let saleCgstInputElement = document.getElementById('sale-cgst');
        let rawSaleCgstString = saleCgstInputElement.value;
        let parsedSaleCgstFloat = parseFloat(rawSaleCgstString);
        let finalSaleCgstFloat = 0;
        if (isSaleGstChecked === true) {
            if (!isNaN(parsedSaleCgstFloat)) {
                finalSaleCgstFloat = parsedSaleCgstFloat;
            }
        }
        
        let saleSgstInputElement = document.getElementById('sale-sgst');
        let rawSaleSgstString = saleSgstInputElement.value;
        let parsedSaleSgstFloat = parseFloat(rawSaleSgstString);
        let finalSaleSgstFloat = 0;
        if (isSaleGstChecked === true) {
            if (!isNaN(parsedSaleSgstFloat)) {
                finalSaleSgstFloat = parsedSaleSgstFloat;
            }
        }
        
        let saleIgstInputElement = document.getElementById('sale-igst');
        let rawSaleIgstString = saleIgstInputElement.value;
        let parsedSaleIgstFloat = parseFloat(rawSaleIgstString);
        let finalSaleIgstFloat = 0;
        if (isSaleGstChecked === true) {
            if (!isNaN(parsedSaleIgstFloat)) {
                finalSaleIgstFloat = parsedSaleIgstFloat;
            }
        }
        
        let totalTaxesAccumulator = finalSaleCgstFloat + finalSaleSgstFloat + finalSaleIgstFloat;
        let calculatedFinalSaleAmount = calculatedSaleTaxableAmount + totalTaxesAccumulator;
        
        let cartPayloadObject = {
            item: trimmedSaleItemName,
            qty: finalSaleQtyInt,
            rate: finalSaleRateFloat,
            hasGST: isSaleGstChecked,
            taxable: calculatedSaleTaxableAmount,
            cgst: finalSaleCgstFloat,
            sgst: finalSaleSgstFloat,
            igst: finalSaleIgstFloat,
            hsn: finalSaleHsnString,
            amount: calculatedFinalSaleAmount
        };
        
        window.saleCart.push(cartPayloadObject);
        
        saleItemInputElement.value = '';
        saleQtyInputElement.value = '';
        saleRateInputElement.value = '';
        saleGstCheckboxElement.checked = false;
        
        let saleTaxSectionElement = document.getElementById('sale-tax-section');
        if (saleTaxSectionElement) {
            saleTaxSectionElement.classList.add('hidden');
        }
        
        updateSaleCartUI();
    });
}

function setupPredictiveSearchSale() {
    let saleItemInputElement = document.getElementById('sale-item');
    let saleItemDropdownElement = document.getElementById('sale-item-dropdown');
    
    if (!saleItemInputElement) {
        return;
    }
    if (!saleItemDropdownElement) {
        return;
    }
    
    document.addEventListener('click', function(event) {
        let targetElement = event.target;
        let isInputContainsTarget = saleItemInputElement.contains(targetElement);
        let isDropdownContainsTarget = saleItemDropdownElement.contains(targetElement);
        
        if (isInputContainsTarget === false) {
            if (isDropdownContainsTarget === false) {
                saleItemDropdownElement.classList.add('hidden');
            }
        }
    });
    
    function triggerSaleSearchRender(searchString) {
        let trimmedSearchString = searchString.trim();
        let lowerSearchString = trimmedSearchString.toLowerCase();
        
        let matchedInventoryArray = [];
        
        if (lowerSearchString !== "") {
            for (let i = 0; i < allInventory.length; i++) {
                let currentItem = allInventory[i];
                let currentItemName = currentItem.name;
                let stringItemName = String(currentItemName);
                let lowerItemName = stringItemName.toLowerCase();
                
                let doesInclude = lowerItemName.includes(lowerSearchString);
                if (doesInclude === true) {
                    matchedInventoryArray.push(currentItem);
                }
            }
        } else {
            matchedInventoryArray = allInventory;
        }
        
        let matchesCount = matchedInventoryArray.length;
        
        if (matchesCount === 0) {
            let noItemsHtmlString = "<div class='p-3 text-xs text-center text-gray-400'>No items found.</div>";
            saleItemDropdownElement.innerHTML = noItemsHtmlString;
        } else {
            let generatedHtmlString = "<div class='p-2 uppercase font-black text-[10px] tracking-[2px] bg-gray-100 text-gray-500'>Inventory Matches:</div>";
            
            let maxDisplayCount = 10;
            let currentDisplayCount = 0;
            
            for (let j = 0; j < matchedInventoryArray.length; j++) {
                if (currentDisplayCount >= maxDisplayCount) {
                    break;
                }
                
                let matchedItem = matchedInventoryArray[j];
                let itemNameOutput = matchedItem.name;
                
                let itemPriceOutput = matchedItem.price;
                if (!itemPriceOutput) {
                    itemPriceOutput = 0;
                }
                
                let itemQtyOutput = matchedItem.qty;
                if (!itemQtyOutput) {
                    itemQtyOutput = 0;
                }
                
                let matchedItemHtmlString = `
                    <div class='p-2 hover:bg-gray-100 border-b cursor-pointer sales-drp text-sm flex items-center justify-between font-bold dark:border-gray-700/50' 
                         data-t='${itemNameOutput}' 
                         data-p='${itemPriceOutput}'>
                        <span>
                            ${itemNameOutput} 
                            <span class="text-[10px] text-gray-400 font-medium">Stk ${itemQtyOutput}</span>
                        </span> 
                        <span class="text-success text-xs bg-success/10 px-2 py-0.5 rounded border border-success/20 shadow-sm font-mono tracking-tight font-medium border">
                            ₹${itemPriceOutput}
                        </span>
                    </div>
                `;
                
                generatedHtmlString = generatedHtmlString + matchedItemHtmlString;
                currentDisplayCount++;
            }
            
            saleItemDropdownElement.innerHTML = generatedHtmlString;
            
            let allDropdownButtons = saleItemDropdownElement.querySelectorAll('.sales-drp');
            for (let k = 0; k < allDropdownButtons.length; k++) {
                let dropdownButton = allDropdownButtons[k];
                dropdownButton.addEventListener('click', function() {
                    let clickedItemName = this.getAttribute('data-t');
                    let clickedItemPrice = this.getAttribute('data-p');
                    
                    saleItemInputElement.value = clickedItemName;
                    
                    let saleRateInputElement = document.getElementById('sale-rate');
                    if (saleRateInputElement) {
                        saleRateInputElement.value = clickedItemPrice;
                    }
                    
                    saleItemDropdownElement.classList.add('hidden');
                });
            }
        }
        
        saleItemDropdownElement.classList.remove('hidden');
    }
    
    saleItemInputElement.addEventListener('focus', function() {
        let currentInputValue = saleItemInputElement.value;
        triggerSaleSearchRender(currentInputValue);
    });
    
    saleItemInputElement.addEventListener('input', function() {
        let currentInputValue = saleItemInputElement.value;
        triggerSaleSearchRender(currentInputValue);
    });
}

let formSaleElement = document.getElementById('form-sale');

if (formSaleElement) {
    formSaleElement.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        let isCartEmpty = true;
        if (window.saleCart) {
            if (window.saleCart.length > 0) {
                isCartEmpty = false;
            }
        }
        
        if (isCartEmpty === true) {
            alert('Cart is empty.');
            return;
        }
        
        let saveSaleButtonElement = document.getElementById('btn-save-sale');
        let originalButtonHtmlString = saveSaleButtonElement.innerHTML;
        
        let processingHtmlString = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        saveSaleButtonElement.innerHTML = processingHtmlString;
        saveSaleButtonElement.disabled = true;
        
        let saleCustomerInputElement = document.getElementById('sale-customer');
        let rawCustomerString = saleCustomerInputElement.value;
        let finalCustomerString = "Cash/Retail Party";
        if (rawCustomerString) {
            finalCustomerString = rawCustomerString;
        }
        let trimmedCustomerString = finalCustomerString.trim();
        
        let saleGstinInputElement = document.getElementById('sale-gstin');
        let rawGstinString = saleGstinInputElement.value;
        let trimmedGstinString = rawGstinString.trim();
        
        try {
            let databaseBatch = writeBatch(db);
            
            let currentTimestampInt = Date.now();
            let timestampString = currentTimestampInt.toString();
            let slicedTimestampString = timestampString.slice(-6);
            let generatedInvoiceNumber = 'TRNS-' + slicedTimestampString;
            
            let currentDateObject = new Date();
            let currentIsoDateString = currentDateObject.toISOString();
            
            for (let i = 0; i < window.saleCart.length; i++) {
                let currentCartItem = window.saleCart[i];
                
                let transactionsCollectionReference = collection(db, 'transactions');
                let newTransactionDocumentReference = doc(transactionsCollectionReference);
                
                let transactionDataPayload = {
                    type: "Sale",
                    item: currentCartItem.item,
                    qty: currentCartItem.qty,
                    rate: currentCartItem.rate,
                    amount: currentCartItem.amount,
                    date: currentIsoDateString,
                    invoiceNo: generatedInvoiceNumber,
                    customerName: trimmedCustomerString,
                    customerGstin: trimmedGstinString,
                    hasGST: currentCartItem.hasGST,
                    cgst: currentCartItem.cgst,
                    sgst: currentCartItem.sgst,
                    igst: currentCartItem.igst,
                    hsn: currentCartItem.hsn,
                    taxable: currentCartItem.taxable
                };
                
                databaseBatch.set(newTransactionDocumentReference, transactionDataPayload);
                
                let matchingInventoryItem = null;
                let cartItemNameString = String(currentCartItem.item);
                let lowerCartItemNameString = cartItemNameString.toLowerCase();
                
                for (let j = 0; j < allInventory.length; j++) {
                    let currentInventoryItem = allInventory[j];
                    let inventoryItemNameString = String(currentInventoryItem.name);
                    let lowerInventoryItemNameString = inventoryItemNameString.toLowerCase();
                    
                    if (lowerInventoryItemNameString === lowerCartItemNameString) {
                        matchingInventoryItem = currentInventoryItem;
                        break;
                    }
                }
                
                if (matchingInventoryItem !== null) {
                    let currentInventoryQty = matchingInventoryItem.qty;
                    let parsedInventoryQty = Number(currentInventoryQty);
                    let finalInventoryQty = 0;
                    if (!isNaN(parsedInventoryQty)) {
                        finalInventoryQty = parsedInventoryQty;
                    }
                    
                    let cartItemQty = currentCartItem.qty;
                    let subtractedQtyAmount = finalInventoryQty - cartItemQty;
                    
                    let finalUpdatedQty = 0;
                    if (subtractedQtyAmount >= 0) {
                        finalUpdatedQty = subtractedQtyAmount;
                    }
                    
                    let inventoryDocumentReference = doc(db, 'inventory', matchingInventoryItem.id);
                    let inventoryUpdatePayload = {
                        qty: finalUpdatedQty
                    };
                    
                    databaseBatch.update(inventoryDocumentReference, inventoryUpdatePayload);
                }
            }
            
            await databaseBatch.commit();
            
            let lowerTrimmedCustomerString = trimmedCustomerString.toLowerCase();
            let isCustomerCash = lowerTrimmedCustomerString === 'cash';
            let isCustomerCashRetail = lowerTrimmedCustomerString === 'cash/retail party';
            
            let isNotCashEntity = false;
            if (isCustomerCash === false) {
                if (isCustomerCashRetail === false) {
                    isNotCashEntity = true;
                }
            }
            
            if (isNotCashEntity === true) {
                let doesCustomerExist = false;
                
                for (let k = 0; k < allCustomers.length; k++) {
                    let currentCustomerObject = allCustomers[k];
                    let currentCustomerNameString = String(currentCustomerObject.name);
                    let lowerCurrentCustomerNameString = currentCustomerNameString.toLowerCase();
                    
                    if (lowerCurrentCustomerNameString === lowerTrimmedCustomerString) {
                        doesCustomerExist = true;
                        break;
                    }
                }
                
                if (doesCustomerExist === false) {
                    let customersCollectionReference = collection(db, 'customers');
                    let newCustomerPayload = {
                        name: trimmedCustomerString,
                        gstin: trimmedGstinString
                    };
                    
                    await addDoc(customersCollectionReference, newCustomerPayload);
                }
            }

            window.saleCart = [];
            updateSaleCartUI();
            
            let formSaleFormElement = document.getElementById('form-sale');
            if (formSaleFormElement) {
                formSaleFormElement.reset();
            }
            
            let gstIndicatorElement = document.getElementById('gst-indicator');
            if (gstIndicatorElement) {
                gstIndicatorElement.classList.add('hidden');
            }
            
            let successMessageString = "Invoiced & Saved (" + generatedInvoiceNumber + ")";
            showSuccessAnimation(successMessageString);

        } catch (error) {
            let errorMessageString = error.message;
            let alertMessageString = "Checkout Logic Failed: " + errorMessageString;
            alert(alertMessageString);
        } finally {
            saveSaleButtonElement.innerHTML = originalButtonHtmlString;
            saveSaleButtonElement.disabled = false;
        }
    });
}

function setupCustomerSearch() {
    let customerInputElement = document.getElementById('sale-customer');
    let customerDropdownElement = document.getElementById('sale-customer-dropdown');
    
    if (!customerInputElement) {
        return;
    }
    if (!customerDropdownElement) {
        return;
    }

    let saleGstinInputElement = document.getElementById('sale-gstin');
    if (saleGstinInputElement) {
        saleGstinInputElement.addEventListener('input', function() {
            let gstIndicatorElement = document.getElementById('gst-indicator');
            if (gstIndicatorElement) {
                let rawGstinValue = saleGstinInputElement.value;
                let trimmedGstinValue = rawGstinValue.trim();
                let isGstinEmpty = trimmedGstinValue === '';
                
                if (isGstinEmpty === false) {
                    gstIndicatorElement.style.display = 'flex';
                } else {
                    gstIndicatorElement.style.display = 'none';
                }
            }
        });
    }
    
    customerInputElement.addEventListener('focus', renderCustomerDropdown);
    customerInputElement.addEventListener('input', renderCustomerDropdown);
    
    customerInputElement.addEventListener('blur', function() {
        setTimeout(function() {
            customerDropdownElement.classList.add('hidden');
        }, 200);
    });

    function renderCustomerDropdown() {
        let rawInputValue = customerInputElement.value;
        let trimmedInputValue = rawInputValue.trim();
        let lowerInputValue = trimmedInputValue.toLowerCase();
        
        let matchedCustomersArray = [];
        
        for (let i = 0; i < allCustomers.length; i++) {
            let currentCustomerObject = allCustomers[i];
            let currentCustomerNameString = String(currentCustomerObject.name);
            let lowerCurrentCustomerNameString = currentCustomerNameString.toLowerCase();
            
            let doesInclude = lowerCurrentCustomerNameString.includes(lowerInputValue);
            if (doesInclude === true) {
                matchedCustomersArray.push(currentCustomerObject);
            }
        }
        
        let htmlContentString = "";
        let matchesCount = matchedCustomersArray.length;
        
        if (matchesCount > 0) {
            let headerHtmlString = "<div class='text-gray-400 p-2 font-bold tracking-[1px] uppercase text-[10px]'>Matched Records</div>";
            htmlContentString = htmlContentString + headerHtmlString;
            
            let maxDisplayCount = 10;
            let currentDisplayCount = 0;
            
            for (let j = 0; j < matchedCustomersArray.length; j++) {
                if (currentDisplayCount >= maxDisplayCount) {
                    break;
                }
                
                let matchedCustomerObject = matchedCustomersArray[j];
                let customerNameOutput = matchedCustomerObject.name;
                
                let customerGstinOutput = matchedCustomerObject.gstin;
                if (!customerGstinOutput) {
                    customerGstinOutput = "";
                }
                
                let customerRowHtmlString = `
                    <div class='sCusDrop hover:bg-gray-100 p-3 text-sm font-bold border-b cursor-pointer flex justify-between' 
                         data-t="${customerNameOutput}" 
                         data-g="${customerGstinOutput}">
                        ${customerNameOutput} 
                        <span class="text-xs font-mono text-gray-500">${customerGstinOutput}</span>
                    </div>
                `;
                
                htmlContentString = htmlContentString + customerRowHtmlString;
                currentDisplayCount++;
            }
            
            customerDropdownElement.innerHTML = htmlContentString;
            customerDropdownElement.classList.remove('hidden');
            
            let allDropdownButtons = customerDropdownElement.querySelectorAll('.sCusDrop');
            
            for (let k = 0; k < allDropdownButtons.length; k++) {
                let dropdownButtonElement = allDropdownButtons[k];
                
                dropdownButtonElement.addEventListener('mousedown', function(event) {
                    event.preventDefault();
                    
                    let dataCustomerName = this.getAttribute('data-t');
                    let dataCustomerGstin = this.getAttribute('data-g');
                    
                    customerInputElement.value = dataCustomerName;
                    
                    let saleGstinTargetInputElement = document.getElementById('sale-gstin');
                    if (saleGstinTargetInputElement) {
                        saleGstinTargetInputElement.value = dataCustomerGstin;
                        
                        let inputEventObject = new Event('input');
                        saleGstinTargetInputElement.dispatchEvent(inputEventObject);
                    }
                    
                    customerDropdownElement.classList.add('hidden');
                });
            }
        } else {
            let isQueryValid = lowerInputValue !== "";
            let isQueryNotCash = lowerInputValue !== 'cash';
            
            let isNewCustomerConditionMet = false;
            if (isQueryValid === true) {
                if (isQueryNotCash === true) {
                    isNewCustomerConditionMet = true;
                }
            }
            
            if (isNewCustomerConditionMet === true) {
                let newCustomerWarningHtmlString = `<div class='p-3 text-[11px] text-gray-400 font-bold'>Adding manually as newly created customer.</div>`;
                customerDropdownElement.innerHTML = newCustomerWarningHtmlString;
                customerDropdownElement.classList.remove('hidden');
            } else {
                customerDropdownElement.classList.add('hidden');
            }
        }
    }
}

let formCosmeticElement = document.getElementById('form-cosmetic');

if (formCosmeticElement) {
    formCosmeticElement.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        let submitterButtonElement = event.submitter;
        let originalSubmitterHtmlString = submitterButtonElement.innerHTML;
        
        submitterButtonElement.disabled = true;
        let processingHtmlString = '<i class="fa-solid fa-bolt fa-bounce text-warning mr-1"></i> Saving...';
        submitterButtonElement.innerHTML = processingHtmlString;
        
        try {
            let cosmeticItemInputElement = document.getElementById('cosmetic-item');
            let rawItemNameString = cosmeticItemInputElement.value;
            let finalItemNameString = rawItemNameString + " (Cosmetic)";
            
            let cosmeticQtyInputElement = document.getElementById('cosmetic-qty');
            let rawQtyString = cosmeticQtyInputElement.value;
            let parsedQtyFloat = parseFloat(rawQtyString);
            
            let cosmeticRateInputElement = document.getElementById('cosmetic-rate');
            let rawRateString = cosmeticRateInputElement.value;
            let parsedRateFloat = parseFloat(rawRateString);
            
            let cosmeticCostInputElement = document.getElementById('cosmetic-cost');
            let rawCostString = cosmeticCostInputElement.value;
            let parsedCostFloat = parseFloat(rawCostString);
            
            let cosmeticGstCheckboxElement = document.getElementById('cosmetic-gst');
            let isGstChecked = cosmeticGstCheckboxElement.checked;
            
            let calculatedAmountFloat = parsedQtyFloat * parsedRateFloat;
            
            let currentDateObject = new Date();
            let currentIsoDateString = currentDateObject.toISOString();
            
            let transactionsCollectionReference = collection(db, 'transactions');
            
            let transactionPayloadObject = {
                type: "Cosmetic Sale",
                item: finalItemNameString,
                qty: parsedQtyFloat,
                rate: parsedRateFloat,
                amount: calculatedAmountFloat,
                cost: parsedCostFloat,
                hasGST: isGstChecked,
                date: currentIsoDateString
            };
            
            await addDoc(transactionsCollectionReference, transactionPayloadObject);
            
            let formCosmeticFormElement = document.getElementById('form-cosmetic');
            formCosmeticFormElement.reset();
            
            let successMessageString = "Cosmetic Sale Recorded!";
            showSuccessAnimation(successMessageString);
            
        } catch (error) {
            let errorMessageString = error.message;
            let alertMessageString = "Error: " + errorMessageString;
            alert(alertMessageString);
        } finally {
            submitterButtonElement.disabled = false;
            submitterButtonElement.innerHTML = originalSubmitterHtmlString;
        }
    });
}

function updateDashboardMetrics() {
    let hasTransactionsData = allTransactions !== undefined && allTransactions !== null;
    let hasInventoryData = allInventory !== undefined && allInventory !== null;
    
    let isDataReady = false;
    if (hasTransactionsData === true) {
        if (hasInventoryData === true) {
            isDataReady = true;
        }
    }
    
    if (isDataReady === false) {
        return;
    }
    
    let totalRevenueAccumulator = 0;
    let totalCostOfGoodsSoldAccumulator = 0;
    
    for (let i = 0; i < allTransactions.length; i++) {
        let currentTransactionObject = allTransactions[i];
        let transactionDateString = currentTransactionObject.date;
        
        let doesYearMatch = isYearMatch(transactionDateString);
        if (doesYearMatch === false) {
            continue;
        }
        
        let transactionAmountValue = currentTransactionObject.amount;
        let parsedAmountValue = Number(transactionAmountValue);
        let finalAmountValue = 0;
        if (!isNaN(parsedAmountValue)) {
            finalAmountValue = parsedAmountValue;
        }
        
        let transactionQtyValue = currentTransactionObject.qty;
        let parsedQtyValue = Number(transactionQtyValue);
        let finalQtyValue = 0;
        if (!isNaN(parsedQtyValue)) {
            finalQtyValue = parsedQtyValue;
        }
        
        let transactionTypeString = currentTransactionObject.type;
        let transactionItemName = currentTransactionObject.item;
        let stringTransactionItemName = String(transactionItemName);
        let lowerTransactionItemName = stringTransactionItemName.toLowerCase();
        
        let inventoryItemPriceValue = 0;
        
        if (transactionTypeString === 'Sale') {
            let matchingInventoryItem = null;
            for (let j = 0; j < allInventory.length; j++) {
                let currentInventoryItem = allInventory[j];
                let inventoryItemNameString = String(currentInventoryItem.name);
                let lowerInventoryItemNameString = inventoryItemNameString.toLowerCase();
                
                if (lowerInventoryItemNameString === lowerTransactionItemName) {
                    matchingInventoryItem = currentInventoryItem;
                    break;
                }
            }
            
            if (matchingInventoryItem !== null) {
                inventoryItemPriceValue = matchingInventoryItem.price;
            }
        }
        
        let finalCostOfGoodsSoldForTransaction = 0;
        
        if (transactionTypeString === 'Sale') {
            finalCostOfGoodsSoldForTransaction = inventoryItemPriceValue * finalQtyValue;
        } else {
            let transactionCostValue = currentTransactionObject.cost;
            let parsedCostValue = Number(transactionCostValue);
            let finalCostValue = 0;
            if (!isNaN(parsedCostValue)) {
                finalCostValue = parsedCostValue;
            }
            finalCostOfGoodsSoldForTransaction = finalCostValue * finalQtyValue;
        }
        
        let isSaleType = transactionTypeString === 'Sale';
        let isCosmeticSaleType = transactionTypeString === 'Cosmetic Sale';
        let isSaleConditionMet = false;
        
        if (isSaleType === true) {
            isSaleConditionMet = true;
        } else if (isCosmeticSaleType === true) {
            isSaleConditionMet = true;
        }
        
        if (isSaleConditionMet === true) {
            totalRevenueAccumulator = totalRevenueAccumulator + finalAmountValue;
            totalCostOfGoodsSoldAccumulator = totalCostOfGoodsSoldAccumulator + finalCostOfGoodsSoldForTransaction;
        } else {
            let isSaleReturnType = transactionTypeString === 'Sale Return';
            let isCosmeticReturnType = transactionTypeString === 'Cosmetic Return';
            let isReturnConditionMet = false;
            
            if (isSaleReturnType === true) {
                isReturnConditionMet = true;
            } else if (isCosmeticReturnType === true) {
                isReturnConditionMet = true;
            }
            
            if (isReturnConditionMet === true) {
                totalRevenueAccumulator = totalRevenueAccumulator - finalAmountValue;
                totalCostOfGoodsSoldAccumulator = totalCostOfGoodsSoldAccumulator - finalCostOfGoodsSoldForTransaction;
            }
        }
    }
    
    let todaySalesAmountAccumulator = 0;
    let todayCostAmountAccumulator = 0;
    let todayItemsCountAccumulator = 0;
    let todayItemFrequencyMap = {};
    
    for (let k = 0; k < allTransactions.length; k++) {
        let iterTransactionObject = allTransactions[k];
        let iterTransactionDateString = iterTransactionObject.date;
        let iterTransactionDateArray = iterTransactionDateString.split('T');
        let iterTransactionDatePart = iterTransactionDateArray[0];
        
        let isTodayTransaction = iterTransactionDatePart === todayStr;
        
        if (isTodayTransaction === true) {
            let iterTransactionTypeString = iterTransactionObject.type;
            
            let isIterSaleType = iterTransactionTypeString.includes('Sale');
            let isIterReturnType = iterTransactionTypeString.includes('Return');
            
            let isValidSaleTransaction = false;
            if (isIterSaleType === true) {
                if (isIterReturnType === false) {
                    isValidSaleTransaction = true;
                }
            }
            
            if (isValidSaleTransaction === true) {
                let iterTransactionAmount = iterTransactionObject.amount;
                let parsedIterAmount = Number(iterTransactionAmount);
                let finalIterAmount = 0;
                if (!isNaN(parsedIterAmount)) {
                    finalIterAmount = parsedIterAmount;
                }
                
                todaySalesAmountAccumulator = todaySalesAmountAccumulator + finalIterAmount;
                
                let iterTransactionItemName = iterTransactionObject.item;
                let stringIterTransactionItemName = String(iterTransactionItemName);
                let lowerIterTransactionItemName = stringIterTransactionItemName.toLowerCase();
                
                let iterInventoryItemPrice = 0;
                
                if (iterTransactionTypeString === 'Sale') {
                    let iterMatchingInventoryItem = null;
                    for (let m = 0; m < allInventory.length; m++) {
                        let iterInventoryItem = allInventory[m];
                        let iterInventoryItemName = String(iterInventoryItem.name);
                        let lowerIterInventoryItemName = iterInventoryItemName.toLowerCase();
                        
                        if (lowerIterInventoryItemName === lowerIterTransactionItemName) {
                            iterMatchingInventoryItem = iterInventoryItem;
                            break;
                        }
                    }
                    
                    if (iterMatchingInventoryItem !== null) {
                        iterInventoryItemPrice = iterMatchingInventoryItem.price;
                    }
                }
                
                let iterTransactionQty = iterTransactionObject.qty;
                let parsedIterQty = Number(iterTransactionQty);
                let finalIterQty = 0;
                if (!isNaN(parsedIterQty)) {
                    finalIterQty = parsedIterQty;
                }
                
                let iterCostCalculationAmount = 0;
                
                if (iterTransactionTypeString === 'Sale') {
                    iterCostCalculationAmount = iterInventoryItemPrice * finalIterQty;
                } else {
                    let iterTransactionCost = iterTransactionObject.cost;
                    iterCostCalculationAmount = iterTransactionCost * finalIterQty;
                }
                
                todayCostAmountAccumulator = todayCostAmountAccumulator + iterCostCalculationAmount;
                todayItemsCountAccumulator = todayItemsCountAccumulator + finalIterQty;
                
                let currentItemFrequency = todayItemFrequencyMap[iterTransactionItemName];
                if (!currentItemFrequency) {
                    currentItemFrequency = 0;
                }
                
                let updatedItemFrequency = currentItemFrequency + finalIterQty;
                todayItemFrequencyMap[iterTransactionItemName] = updatedItemFrequency;
            }
        }
    }
    
    let inventoryTotalItemsCount = 0;
    let inventoryOutOfStockCount = 0;
    let inventoryLowStockCount = 0;
    let inventoryTotalValueAccumulator = 0;
    
    for (let n = 0; n < allInventory.length; n++) {
        let loopInventoryItem = allInventory[n];
        let loopInventoryItemQty = loopInventoryItem.qty;
        let loopInventoryItemPrice = loopInventoryItem.price;
        
        let inventoryItemValue = loopInventoryItemQty * loopInventoryItemPrice;
        
        inventoryTotalItemsCount = inventoryTotalItemsCount + loopInventoryItemQty;
        inventoryTotalValueAccumulator = inventoryTotalValueAccumulator + inventoryItemValue;
        
        if (loopInventoryItemQty === 0) {
            inventoryOutOfStockCount++;
        } else if (loopInventoryItemQty <= 3) {
            inventoryLowStockCount++;
        }
    }

    let trendingItemNameString = "N/A";
    let trendingItemMaxQtyValue = 0;
    
    let frequencyKeysArray = Object.keys(todayItemFrequencyMap);
    for (let p = 0; p < frequencyKeysArray.length; p++) {
        let currentFrequencyKey = frequencyKeysArray[p];
        let currentFrequencyValue = todayItemFrequencyMap[currentFrequencyKey];
        
        if (currentFrequencyValue > trendingItemMaxQtyValue) {
            trendingItemMaxQtyValue = currentFrequencyValue;
            trendingItemNameString = currentFrequencyKey;
        }
    }

    let dashTodaySalesElement = document.getElementById('dash-today-sales');
    
    if (dashTodaySalesElement) {
        let todayProfitAmount = todaySalesAmountAccumulator - todayCostAmountAccumulator;
        
        let todayMarginString = '0%';
        if (todaySalesAmountAccumulator > 0) {
            let marginRatioValue = todayProfitAmount / todaySalesAmountAccumulator;
            let marginPercentageValue = marginRatioValue * 100;
            let fixedMarginPercentage = marginPercentageValue.toFixed(1);
            todayMarginString = fixedMarginPercentage + '%';
        }
        
        let dashTodayProfitElement = document.getElementById('dash-today-profit');
        let dashTodayMarginElement = document.getElementById('dash-today-margin');
        let dashTodayItemsElement = document.getElementById('dash-today-items');
        let dashTodayTrendingElement = document.getElementById('dash-today-trending');
        
        let dashOverallRevenueElement = document.getElementById('dash-overall-revenue');
        let dashOverallProfitElement = document.getElementById('dash-overall-profit');
        let dashInvValueElement = document.getElementById('dash-inv-value');
        let dashLowStockElement = document.getElementById('dash-low-stock');
        let dashInventoryElement = document.getElementById('dash-inventory');
        
        dashTodaySalesElement.innerText = `₹${todaySalesAmountAccumulator.toFixed(2)}`;
        dashTodayProfitElement.innerText = `₹${todayProfitAmount.toFixed(2)}`;
        dashTodayMarginElement.innerText = todayMarginString;
        dashTodayItemsElement.innerText = todayItemsCountAccumulator;
        dashTodayTrendingElement.innerText = trendingItemNameString;
        
        let overallProfitAmount = totalRevenueAccumulator - totalCostOfGoodsSoldAccumulator;
        
        dashOverallRevenueElement.innerText = `₹${totalRevenueAccumulator.toFixed(2)}`;
        dashOverallProfitElement.innerText = `₹${overallProfitAmount.toFixed(2)}`;
        dashInvValueElement.innerText = `₹${inventoryTotalValueAccumulator.toFixed(2)}`;
        dashLowStockElement.innerText = inventoryLowStockCount;
        dashInventoryElement.innerText = inventoryTotalItemsCount;
    }
}

function renderTransactionsTable() {
    let tbodyElement = document.querySelector('#table-transactions tbody');
    if (!tbodyElement) {
        return;
    }
    
    let filterStartElement = document.getElementById('filter-trans-start');
    let filterEndElement = document.getElementById('filter-trans-end');
    let filterGstElement = document.getElementById('filter-trans-gst');
    
    let startValueString = filterStartElement.value;
    let endValueString = filterEndElement.value;
    let gstFilterValueString = filterGstElement.value;
    
    let startDateObject = null;
    if (startValueString) {
        let startDateTimeString = startValueString + 'T00:00:00';
        startDateObject = new Date(startDateTimeString);
    }
    
    let endDateObject = null;
    if (endValueString) {
        let endDateTimeString = endValueString + 'T23:59:59';
        endDateObject = new Date(endDateTimeString);
    }

    let htmlContentString = "";
    
    for (let i = 0; i < allTransactions.length; i++) {
        let currentTransactionObject = allTransactions[i];
        let transactionDateString = currentTransactionObject.date;
        
        let doesYearMatch = isYearMatch(transactionDateString);
        if (doesYearMatch === false) {
            continue;
        }
        
        let transactionDateObject = new Date(transactionDateString);
        
        if (startDateObject !== null) {
            if (transactionDateObject < startDateObject) {
                continue;
            }
        }
        
        if (endDateObject !== null) {
            if (transactionDateObject > endDateObject) {
                continue;
            }
        }
        
        let hasGstFlag = currentTransactionObject.hasGST;
        
        let isGstFilterActive = gstFilterValueString === 'GST';
        if (isGstFilterActive === true) {
            if (hasGstFlag === false) {
                continue;
            }
        }
        
        let isNonGstFilterActive = gstFilterValueString === 'Non-GST';
        if (isNonGstFilterActive === true) {
            if (hasGstFlag === true) {
                continue;
            }
        }
        
        let transactionTypeString = currentTransactionObject.type;
        let textClassString = "";
        
        let isSaleType = transactionTypeString.includes('Sale');
        if (isSaleType === true) {
            let isCosmeticType = transactionTypeString.includes('Cosmetic');
            if (isCosmeticType === true) {
                textClassString = 'text-cosmetic';
            } else {
                textClassString = 'text-success';
            }
        } else {
            let isPurchaseType = transactionTypeString.includes('Purchase');
            if (isPurchaseType === true) {
                textClassString = 'text-danger';
            } else {
                textClassString = 'text-warning';
            }
        }
        
        let buttonHtmlString = "";
        let isSaleExactType = transactionTypeString === 'Sale';
        let isPurchaseExactType = transactionTypeString === 'Purchase';
        let isCosmeticSaleExactType = transactionTypeString === 'Cosmetic Sale';
        
        let isActionableType = false;
        if (isSaleExactType === true) {
            isActionableType = true;
        } else if (isPurchaseExactType === true) {
            isActionableType = true;
        } else if (isCosmeticSaleExactType === true) {
            isActionableType = true;
        }
        
        if (isActionableType === true) {
            buttonHtmlString = `<button class="btn-return bg-warning/20 text-warning hover:bg-warning hover:text-white px-3 py-1 rounded text-xs font-bold transition-colors active:scale-95" data-id="${currentTransactionObject.id}">Return</button>`;
        } else {
            buttonHtmlString = `<span class="text-xs text-gray-400 font-bold italic border border-gray-300 dark:border-gray-700 px-2 py-0.5 rounded shadow-sm bg-gray-50/50 dark:bg-gray-800">RTN/VOlD</span>`;
        }
        
        let gstBadgeHtmlString = "";
        if (hasGstFlag === true) {
            gstBadgeHtmlString = `<span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 text-[10px] px-1 py-0.5 rounded ml-2 font-bold uppercase shadow-sm">GST</span>`;
        }
        
        let extraDetailsHtmlString = "";
        if (transactionTypeString === 'Purchase') {
            let supplierString = currentTransactionObject.supplier;
            if (!supplierString) {
                supplierString = "No Sup.";
            }
            
            let invoiceString = currentTransactionObject.invoice;
            if (!invoiceString) {
                invoiceString = "N/A";
            }
            
            extraDetailsHtmlString = extraDetailsHtmlString + `<span class="block text-[10px] text-gray-500 font-mono mt-0.5"><i class="fa-solid fa-industry text-[8px] mr-0.5"></i> ${supplierString} | ${invoiceString}</span>`;
        }
        
        if (transactionTypeString === 'Sale') {
            let invoiceNoString = currentTransactionObject.invoiceNo;
            if (!invoiceNoString) {
                invoiceNoString = "";
            }
            
            let customerNameString = currentTransactionObject.customerName;
            if (!customerNameString) {
                customerNameString = "";
            }
            
            extraDetailsHtmlString = extraDetailsHtmlString + `<span class="block text-[10px] text-gray-500 font-mono mt-0.5"><i class="fa-solid fa-barcode text-[8px] mr-0.5"></i> ${invoiceNoString} | Party: ${customerNameString}</span>`;
        }

        let transactionAmountValue = currentTransactionObject.amount;
        let parsedAmountValue = Number(transactionAmountValue);
        let finalAmountValue = 0;
        if (!isNaN(parsedAmountValue)) {
            finalAmountValue = parsedAmountValue;
        }
        let formattedAmountString = finalAmountValue.toFixed(2);
        
        let transactionDateFormattedString = transactionDateObject.toLocaleDateString();

        let rowHtmlString = `
            <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800 transition-colors">
                <td class="px-6 py-4 text-xs font-mono tracking-tight font-medium align-top">${transactionDateFormattedString}</td>
                <td class="px-6 py-4 text-[13px] font-bold tracking-tight align-top ${textClassString}">${transactionTypeString}</td>
                <td class="px-6 py-4 align-top">
                    <div class="flex items-start text-[13px] font-semibold text-gray-900 dark:text-gray-100">${currentTransactionObject.item} ${gstBadgeHtmlString}</div>
                    ${extraDetailsHtmlString}
                </td>
                <td class="px-6 py-4 text-xs font-bold text-center font-mono align-top">${currentTransactionObject.qty}</td>
                <td class="px-6 py-4 text-sm font-black text-right tracking-tight align-top">₹${formattedAmountString}</td>
                <td class="px-6 py-4 text-center align-top">${buttonHtmlString}</td>
            </tr>
        `;
        
        htmlContentString = htmlContentString + rowHtmlString;
    }
    
    tbodyElement.innerHTML = htmlContentString;
}

let btnTransFilterElement = document.getElementById('btn-trans-filter');
if (btnTransFilterElement) {
    btnTransFilterElement.addEventListener('click', function() {
        renderTransactionsTable();
    });
}

let btnTransClearElement = document.getElementById('btn-trans-clear');
if (btnTransClearElement) {
    btnTransClearElement.addEventListener('click', function() {
        let startInputElement = document.getElementById('filter-trans-start');
        let endInputElement = document.getElementById('filter-trans-end');
        let gstFilterElement = document.getElementById('filter-trans-gst');
        
        if (startInputElement) {
            startInputElement.value = '';
        }
        if (endInputElement) {
            endInputElement.value = '';
        }
        if (gstFilterElement) {
            gstFilterElement.value = 'All';
        }
        
        renderTransactionsTable();
    });
}

function updateDashboardMonths(transactionsArray) {
    let monthSelectElement = document.getElementById('dash-top-month');
    if (!monthSelectElement) {
        return;
    }
    
    let currentValueString = monthSelectElement.value;
    let monthsSetObject = new Set();
    
    let currentDateObject = new Date();
    let currentMonthLocaleString = currentDateObject.toLocaleString('default', {month:'long', year:'numeric'});
    monthsSetObject.add(currentMonthLocaleString);
    
    for (let i = 0; i < transactionsArray.length; i++) {
        let currentTransactionObject = transactionsArray[i];
        let transactionDateString = currentTransactionObject.date;
        
        let doesYearMatch = isYearMatch(transactionDateString);
        if (doesYearMatch === true) {
            let transactionDateObject = new Date(transactionDateString);
            let transactionMonthLocaleString = transactionDateObject.toLocaleString('default', {month:'long', year:'numeric'});
            monthsSetObject.add(transactionMonthLocaleString);
        }
    }
    
    let htmlContentString = "";
    let monthsArray = Array.from(monthsSetObject);
    
    for (let j = 0; j < monthsArray.length; j++) {
        let currentMonthString = monthsArray[j];
        let optionHtmlString = `<option value="${currentMonthString}">${currentMonthString}</option>`;
        htmlContentString = htmlContentString + optionHtmlString;
    }
    
    monthSelectElement.innerHTML = htmlContentString;
    
    let hasCurrentValue = monthsSetObject.has(currentValueString);
    if (currentValueString) {
        if (hasCurrentValue === true) {
            monthSelectElement.value = currentValueString;
        }
    }
}

let dashTopMonthElement = document.getElementById('dash-top-month');
if (dashTopMonthElement) {
    dashTopMonthElement.addEventListener('change', function() {
        renderDashboardTopItems();
    });
}

let dashTopTypeElement = document.getElementById('dash-top-type');
if (dashTopTypeElement) {
    dashTopTypeElement.addEventListener('change', function() {
        renderDashboardTopItems();
    });
}

function renderDashboardTopItems() {
    let monthSelectElement = document.getElementById('dash-top-month');
    let typeSelectElement = document.getElementById('dash-top-type');
    let listContainerElement = document.getElementById('dash-top-list');
    
    if (!monthSelectElement) {
        return;
    }
    if (!typeSelectElement) {
        return;
    }
    
    let monthValueString = monthSelectElement.value;
    let typeValueString = typeSelectElement.value;
    
    let itemSalesMapObject = {};
    
    for (let i = 0; i < allTransactions.length; i++) {
        let currentTransactionObject = allTransactions[i];
        let transactionDateString = currentTransactionObject.date;
        let transactionTypeString = currentTransactionObject.type;
        
        let doesYearMatch = isYearMatch(transactionDateString);
        if (doesYearMatch === false) {
            continue;
        }
        
        let isSaleTypeTransaction = transactionTypeString.includes('Sale');
        if (isSaleTypeTransaction === false) {
            continue;
        }
        
        let isTypeFilterAll = typeValueString === 'All';
        if (isTypeFilterAll === false) {
            if (transactionTypeString !== typeValueString) {
                continue;
            }
        }
        
        let transactionDateObject = new Date(transactionDateString);
        let transactionMonthLocaleString = transactionDateObject.toLocaleString('default', {month:'long', year:'numeric'});
        
        let isMonthFilterAll = monthValueString === 'All';
        if (isMonthFilterAll === false) {
            if (transactionMonthLocaleString !== monthValueString) {
                continue;
            }
        }

        let transactionItemName = currentTransactionObject.item;
        
        let currentMappedValue = itemSalesMapObject[transactionItemName];
        if (!currentMappedValue) {
            itemSalesMapObject[transactionItemName] = 0;
        }
        
        let transactionQtyValue = currentTransactionObject.qty;
        let parsedQtyValue = Number(transactionQtyValue);
        
        let isExactSaleType = transactionTypeString === 'Sale';
        let isExactCosmeticSaleType = transactionTypeString === 'Cosmetic Sale';
        
        let isAdditionOperation = false;
        if (isExactSaleType === true) {
            isAdditionOperation = true;
        } else if (isExactCosmeticSaleType === true) {
            isAdditionOperation = true;
        }
        
        if (isAdditionOperation === true) {
            itemSalesMapObject[transactionItemName] = itemSalesMapObject[transactionItemName] + parsedQtyValue;
        } else {
            itemSalesMapObject[transactionItemName] = itemSalesMapObject[transactionItemName] - parsedQtyValue;
        }
    }
    
    let mapKeysArray = Object.keys(itemSalesMapObject);
    let itemsArray = [];
    
    for (let j = 0; j < mapKeysArray.length; j++) {
        let currentKeyString = mapKeysArray[j];
        let currentQtyValue = itemSalesMapObject[currentKeyString];
        
        let itemPayloadObject = {
            n: currentKeyString,
            q: currentQtyValue
        };
        
        itemsArray.push(itemPayloadObject);
    }
    
    let filteredItemsArray = [];
    for (let k = 0; k < itemsArray.length; k++) {
        let iterItemObject = itemsArray[k];
        let iterItemQty = iterItemObject.q;
        
        if (iterItemQty > 0) {
            filteredItemsArray.push(iterItemObject);
        }
    }
    
    filteredItemsArray.sort(function(a, b) {
        return b.q - a.q;
    });
    
    let slicedItemsArray = filteredItemsArray.slice(0, 10);
    let htmlContentString = "";
    
    let itemsCount = slicedItemsArray.length;
    if (itemsCount === 0) {
        let noRecordsHtmlString = `<li class="text-center text-sm p-4 text-gray-500 font-medium">No records found.</li>`;
        listContainerElement.innerHTML = noRecordsHtmlString;
        return;
    }
    
    let rankIndexValue = 1;
    
    for (let m = 0; m < slicedItemsArray.length; m++) {
        let currentSlicedItemObject = slicedItemsArray[m];
        let itemNameString = currentSlicedItemObject.n;
        let itemQtyValue = currentSlicedItemObject.q;
        
        let colorCodeString = "";
        if (rankIndexValue === 1) {
            colorCodeString = '#10b981';
        } else if (rankIndexValue === 2) {
            colorCodeString = '#f59e0b';
        } else if (rankIndexValue === 3) {
            colorCodeString = '#3b82f6';
        } else {
            colorCodeString = '#9ca3af';
        }
        
        let iconHtmlString = "";
        if (rankIndexValue <= 3) {
            iconHtmlString = `<i class="fa-solid fa-medal" style="color: ${colorCodeString}"></i>`;
        } else {
            iconHtmlString = `<span class="inline-block bg-gray-200 text-gray-600 rounded text-center w-5 font-bold shadow text-xs py-0.5">${rankIndexValue}</span>`;
        }
        
        let listItemHtmlString = `
            <li class="flex justify-between items-center py-2 px-3 rounded hover:bg-gray-50 transition border-b dark:border-gray-700/30 font-semibold">
                <span class="text-[13px] tracking-tight truncate">
                    ${iconHtmlString} 
                    <span class="ml-2">${itemNameString}</span>
                </span>
                <span class="text-xs font-mono font-bold text-success px-2 border border-success/30 bg-success/10 py-0.5 rounded shadow-sm">
                    ${itemQtyValue} sold
                </span>
            </li>
        `;
        
        htmlContentString = htmlContentString + listItemHtmlString;
        rankIndexValue++;
    }
    
    listContainerElement.innerHTML = htmlContentString;
}

let tableTransactionsTbodyElement = document.querySelector('#table-transactions tbody');

if (tableTransactionsTbodyElement) {
    tableTransactionsTbodyElement.addEventListener('click', async function(event) {
        let targetElement = event.target;
        let isReturnButtonClass = targetElement.classList.contains('btn-return');
        
        if (isReturnButtonClass === true) {
            let buttonElement = targetElement;
            buttonElement.disabled = true;
            let originalHtmlString = buttonElement.innerHTML;
            
            let transactionIdString = buttonElement.getAttribute('data-id');
            let targetTransactionObject = null;
            
            for (let i = 0; i < allTransactions.length; i++) {
                let currentTransactionObject = allTransactions[i];
                let currentTransactionId = currentTransactionObject.id;
                
                if (currentTransactionId === transactionIdString) {
                    targetTransactionObject = currentTransactionObject;
                    break;
                }
            }
            
            if (targetTransactionObject === null) {
                buttonElement.disabled = false;
                return;
            }
            
            let promptMessageString = "Return Qty?\n(Max: " + targetTransactionObject.qty + ")";
            let promptResponseString = prompt(promptMessageString);
            
            if (promptResponseString === null) {
                buttonElement.disabled = false;
                return;
            }
            
            let parsedResponseQty = parseInt(promptResponseString);
            
            let isResponseNaN = isNaN(parsedResponseQty);
            let isResponseZeroOrLess = parsedResponseQty <= 0;
            let isResponseGreaterThanMax = parsedResponseQty > targetTransactionObject.qty;
            
            let isResponseInvalid = false;
            if (isResponseNaN === true) {
                isResponseInvalid = true;
            } else if (isResponseZeroOrLess === true) {
                isResponseInvalid = true;
            } else if (isResponseGreaterThanMax === true) {
                isResponseInvalid = true;
            }
            
            if (isResponseInvalid === true) {
                alert("Invalid Qty");
                buttonElement.disabled = false;
                return;
            }
            
            let processingSpinnerHtml = `<i class="fa-solid fa-spin fa-circle-notch"></i>`;
            buttonElement.innerHTML = processingSpinnerHtml;
            
            try {
                let databaseBatchObject = writeBatch(db);
                
                let transactionAmountValue = targetTransactionObject.amount;
                let transactionQtyValue = targetTransactionObject.qty;
                
                let unitAmountValue = transactionAmountValue / transactionQtyValue;
                let deductionAmountValue = unitAmountValue * parsedResponseQty;

                let isFullReturn = parsedResponseQty === transactionQtyValue;
                
                if (isFullReturn === true) {
                    let transactionDocumentReference = doc(db, "transactions", targetTransactionObject.id);
                    databaseBatchObject.delete(transactionDocumentReference);
                } else {
                    let updatedQtyValue = transactionQtyValue - parsedResponseQty;
                    let updatedAmountValue = transactionAmountValue - deductionAmountValue;
                    
                    let transactionDocumentReference = doc(db, "transactions", targetTransactionObject.id);
                    let updatePayloadObject = {
                        qty: updatedQtyValue,
                        amount: updatedAmountValue
                    };
                    
                    databaseBatchObject.update(transactionDocumentReference, updatePayloadObject);
                }
                
                let transactionTypeString = targetTransactionObject.type;
                let isCosmeticType = transactionTypeString.includes('Cosmetic');
                
                if (isCosmeticType === false) {
                    let transactionItemName = targetTransactionObject.item;
                    let targetInventoryItemObject = null;
                    
                    for (let j = 0; j < allInventory.length; j++) {
                        let currentInventoryItem = allInventory[j];
                        let currentInventoryItemName = currentInventoryItem.name;
                        
                        if (currentInventoryItemName === transactionItemName) {
                            targetInventoryItemObject = currentInventoryItem;
                            break;
                        }
                    }
                    
                    if (targetInventoryItemObject !== null) {
                        let currentInventoryQtyValue = targetInventoryItemObject.qty;
                        let parsedInventoryQtyValue = Number(currentInventoryQtyValue);
                        let finalInventoryQtyValue = 0;
                        
                        if (!isNaN(parsedInventoryQtyValue)) {
                            finalInventoryQtyValue = parsedInventoryQtyValue;
                        }
                        
                        let isSaleType = transactionTypeString === 'Sale';
                        let isPurchaseType = transactionTypeString === 'Purchase';
                        
                        if (isSaleType === true) {
                            finalInventoryQtyValue = finalInventoryQtyValue + parsedResponseQty;
                        } else if (isPurchaseType === true) {
                            finalInventoryQtyValue = finalInventoryQtyValue - parsedResponseQty;
                        }
                        
                        let safeInventoryQtyValue = 0;
                        if (finalInventoryQtyValue > 0) {
                            safeInventoryQtyValue = finalInventoryQtyValue;
                        }
                        
                        let inventoryDocumentReference = doc(db, "inventory", targetInventoryItemObject.id);
                        let inventoryUpdatePayload = {
                            qty: safeInventoryQtyValue
                        };
                        
                        databaseBatchObject.update(inventoryDocumentReference, inventoryUpdatePayload);
                    }
                }
                
                await databaseBatchObject.commit();
                
                let successMessageString = "Return Processed Successfully!";
                showSuccessAnimation(successMessageString);
                
            } catch (error) {
                alert('Return failed.');
                buttonElement.disabled = false;
                buttonElement.innerHTML = originalHtmlString;
            }
        }
    });
}

let btnAnaFilterElement = document.getElementById('btn-ana-filter');
if (btnAnaFilterElement) {
    btnAnaFilterElement.addEventListener('click', function() {
        runAnalytics();
    });
}

let btnAnaClearElement = document.getElementById('btn-ana-clear');
if (btnAnaClearElement) {
    btnAnaClearElement.addEventListener('click', function() {
        let anaStartElement = document.getElementById('ana-start');
        if (anaStartElement) {
            anaStartElement.value = '';
        }
        
        let anaEndElement = document.getElementById('ana-end');
        if (anaEndElement) {
            anaEndElement.value = '';
        }
        
        runAnalytics();
    });
}

let btnAnaTodayElement = document.getElementById('btn-ana-today');
if (btnAnaTodayElement) {
    btnAnaTodayElement.addEventListener('click', function() {
        let anaStartElement = document.getElementById('ana-start');
        if (anaStartElement) {
            anaStartElement.value = todayStr;
        }
        
        let anaEndElement = document.getElementById('ana-end');
        if (anaEndElement) {
            anaEndElement.value = todayStr;
        }
        
        runAnalytics();
    });
}

let filterTopSellingElement = document.getElementById('filter-top-selling');
if (filterTopSellingElement) {
    filterTopSellingElement.addEventListener('change', function() {
        runAnalytics();
    });
}

let filterInvStatusElement = document.getElementById('filter-inv-status');
if (filterInvStatusElement) {
    filterInvStatusElement.addEventListener('change', function() {
        runAnalytics();
    });
}

let anaClassFilterElement = document.getElementById('ana-class-filter');
if (anaClassFilterElement) {
    anaClassFilterElement.addEventListener('change', function() {
        runAnalytics();
    });
}

function runAnalytics() {
    let tabAnalyticsElement = document.getElementById('tab-analytics');
    if (!tabAnalyticsElement) {
        return;
    }
    
    let isTabActive = tabAnalyticsElement.classList.contains('active');
    if (isTabActive === false) {
        return;
    }
    
    let anaStartElement = document.getElementById('ana-start');
    let anaStartValueString = anaStartElement.value;
    let startDateObject = null;
    
    if (anaStartValueString) {
        let formattedStartString = anaStartValueString + 'T00:00:00';
        startDateObject = new Date(formattedStartString);
    }
    
    let anaEndElement = document.getElementById('ana-end');
    let anaEndValueString = anaEndElement.value;
    let endDateObject = null;
    
    if (anaEndValueString) {
        let formattedEndString = anaEndValueString + 'T23:59:59';
        endDateObject = new Date(formattedEndString);
    }

    let revenueAccumulatorValue = 0;
    let costOfGoodsAccumulatorValue = 0;
    
    let itemStatsMapObject = {};
    let monthlyStatsMapObject = {};

    for (let i = 0; i < allInventory.length; i++) {
        let currentInventoryItem = allInventory[i];
        let itemNameString = currentInventoryItem.name;
        
        let itemQtyValue = currentInventoryItem.qty;
        let itemPriceValue = currentInventoryItem.price;
        let itemTotalValue = itemQtyValue * itemPriceValue;
        
        let initialStatsPayload = {
            stk: itemQtyValue,
            uC: itemPriceValue,
            vv: itemTotalValue,
            qS: 0,
            rr: 0
        };
        
        itemStatsMapObject[itemNameString] = initialStatsPayload;
    }
    
    for (let j = 0; j < allTransactions.length; j++) {
        let currentTransactionObject = allTransactions[j];
        let transactionDateString = currentTransactionObject.date;
        
        let doesYearMatch = isYearMatch(transactionDateString);
        if (doesYearMatch === false) {
            continue;
        }
        
        let transactionDateObject = new Date(transactionDateString);
        
        if (startDateObject !== null) {
            if (transactionDateObject < startDateObject) {
                continue;
            }
        }
        
        if (endDateObject !== null) {
            if (transactionDateObject > endDateObject) {
                continue;
            }
        }

        let transactionMonthLocaleString = transactionDateObject.toLocaleString('default', {month:'short', year:'numeric'});
        
        let existingMonthObject = monthlyStatsMapObject[transactionMonthLocaleString];
        if (!existingMonthObject) {
            let initialMonthPayload = {
                ss: 0,
                pp: 0
            };
            monthlyStatsMapObject[transactionMonthLocaleString] = initialMonthPayload;
        }

        let transactionQtyValue = currentTransactionObject.qty;
        let parsedQtyValue = Number(transactionQtyValue);
        let finalQtyValue = 0;
        if (!isNaN(parsedQtyValue)) {
            finalQtyValue = parsedQtyValue;
        }
        
        let transactionAmountValue = currentTransactionObject.amount;
        let parsedAmountValue = Number(transactionAmountValue);
        let finalAmountValue = 0;
        if (!isNaN(parsedAmountValue)) {
            finalAmountValue = parsedAmountValue;
        }
        
        let transactionTypeString = currentTransactionObject.type;
        let transactionItemName = currentTransactionObject.item;
        
        if (transactionTypeString === 'Sale') {
            revenueAccumulatorValue = revenueAccumulatorValue + finalAmountValue;
            
            let currentMonthSalesValue = monthlyStatsMapObject[transactionMonthLocaleString].ss;
            let updatedMonthSalesValue = currentMonthSalesValue + finalAmountValue;
            monthlyStatsMapObject[transactionMonthLocaleString].ss = updatedMonthSalesValue;
            
            let calculatedCostValue = 0;
            let currentItemStatsObject = itemStatsMapObject[transactionItemName];
            
            if (currentItemStatsObject) {
                let itemUnitCostValue = currentItemStatsObject.uC;
                calculatedCostValue = itemUnitCostValue * finalQtyValue;
                
                let currentItemQtySoldValue = currentItemStatsObject.qS;
                let updatedItemQtySoldValue = currentItemQtySoldValue + finalQtyValue;
                itemStatsMapObject[transactionItemName].qS = updatedItemQtySoldValue;
                
                let currentItemRevenueValue = currentItemStatsObject.rr;
                let updatedItemRevenueValue = currentItemRevenueValue + finalAmountValue;
                itemStatsMapObject[transactionItemName].rr = updatedItemRevenueValue;
            }
            
            costOfGoodsAccumulatorValue = costOfGoodsAccumulatorValue + calculatedCostValue;
            
            let currentTransactionProfitValue = finalAmountValue - calculatedCostValue;
            let currentMonthProfitValue = monthlyStatsMapObject[transactionMonthLocaleString].pp;
            let updatedMonthProfitValue = currentMonthProfitValue + currentTransactionProfitValue;
            monthlyStatsMapObject[transactionMonthLocaleString].pp = updatedMonthProfitValue;
            
        } else if (transactionTypeString === 'Cosmetic Sale') {
            revenueAccumulatorValue = revenueAccumulatorValue + finalAmountValue;
            
            let currentMonthSalesValue = monthlyStatsMapObject[transactionMonthLocaleString].ss;
            let updatedMonthSalesValue = currentMonthSalesValue + finalAmountValue;
            monthlyStatsMapObject[transactionMonthLocaleString].ss = updatedMonthSalesValue;
            
            let transactionCostValue = currentTransactionObject.cost;
            let parsedTransactionCostValue = parseFloat(transactionCostValue);
            let finalTransactionCostValue = 0;
            if (!isNaN(parsedTransactionCostValue)) {
                finalTransactionCostValue = parsedTransactionCostValue;
            }
            
            let calculatedCostValue = finalTransactionCostValue * finalQtyValue;
            costOfGoodsAccumulatorValue = costOfGoodsAccumulatorValue + calculatedCostValue;
            
            let currentTransactionProfitValue = finalAmountValue - calculatedCostValue;
            let currentMonthProfitValue = monthlyStatsMapObject[transactionMonthLocaleString].pp;
            let updatedMonthProfitValue = currentMonthProfitValue + currentTransactionProfitValue;
            monthlyStatsMapObject[transactionMonthLocaleString].pp = updatedMonthProfitValue;
            
        } else if (transactionTypeString === 'Sale Return') {
            revenueAccumulatorValue = revenueAccumulatorValue - finalAmountValue;
            
            let currentMonthSalesValue = monthlyStatsMapObject[transactionMonthLocaleString].ss;
            let updatedMonthSalesValue = currentMonthSalesValue - finalAmountValue;
            monthlyStatsMapObject[transactionMonthLocaleString].ss = updatedMonthSalesValue;
            
            let calculatedCostValue = 0;
            let currentItemStatsObject = itemStatsMapObject[transactionItemName];
            
            if (currentItemStatsObject) {
                let itemUnitCostValue = currentItemStatsObject.uC;
                calculatedCostValue = itemUnitCostValue * finalQtyValue;
                
                let currentItemQtySoldValue = currentItemStatsObject.qS;
                let updatedItemQtySoldValue = currentItemQtySoldValue - finalQtyValue;
                itemStatsMapObject[transactionItemName].qS = updatedItemQtySoldValue;
                
                let currentItemRevenueValue = currentItemStatsObject.rr;
                let updatedItemRevenueValue = currentItemRevenueValue - finalAmountValue;
                itemStatsMapObject[transactionItemName].rr = updatedItemRevenueValue;
            }
            
            costOfGoodsAccumulatorValue = costOfGoodsAccumulatorValue - calculatedCostValue;
            
            let currentTransactionProfitValue = finalAmountValue - calculatedCostValue;
            let currentMonthProfitValue = monthlyStatsMapObject[transactionMonthLocaleString].pp;
            let updatedMonthProfitValue = currentMonthProfitValue - currentTransactionProfitValue;
            monthlyStatsMapObject[transactionMonthLocaleString].pp = updatedMonthProfitValue;
            
        } else if (transactionTypeString === 'Cosmetic Return') {
            revenueAccumulatorValue = revenueAccumulatorValue - finalAmountValue;
            
            let currentMonthSalesValue = monthlyStatsMapObject[transactionMonthLocaleString].ss;
            let updatedMonthSalesValue = currentMonthSalesValue - finalAmountValue;
            monthlyStatsMapObject[transactionMonthLocaleString].ss = updatedMonthSalesValue;
            
            let transactionCostValue = currentTransactionObject.cost;
            let parsedTransactionCostValue = parseFloat(transactionCostValue);
            let finalTransactionCostValue = 0;
            if (!isNaN(parsedTransactionCostValue)) {
                finalTransactionCostValue = parsedTransactionCostValue;
            }
            
            let calculatedCostValue = finalTransactionCostValue * finalQtyValue;
            costOfGoodsAccumulatorValue = costOfGoodsAccumulatorValue - calculatedCostValue;
            
            let currentTransactionProfitValue = finalAmountValue - calculatedCostValue;
            let currentMonthProfitValue = monthlyStatsMapObject[transactionMonthLocaleString].pp;
            let updatedMonthProfitValue = currentMonthProfitValue - currentTransactionProfitValue;
            monthlyStatsMapObject[transactionMonthLocaleString].pp = updatedMonthProfitValue;
        }
    }
    
    let anaRevenueElement = document.getElementById('ana-revenue');
    if (anaRevenueElement) {
        let totalProfitAmountValue = revenueAccumulatorValue - costOfGoodsAccumulatorValue;
        
        let marginPercentageString = "0";
        if (revenueAccumulatorValue > 0) {
            let marginRatioValue = totalProfitAmountValue / revenueAccumulatorValue;
            let marginPercentageValue = marginRatioValue * 100;
            let fixedMarginPercentage = marginPercentageValue.toFixed(1);
            marginPercentageString = fixedMarginPercentage;
        }
        
        let fixedRevenueAccumulator = revenueAccumulatorValue.toFixed(2);
        anaRevenueElement.innerText = `₹${fixedRevenueAccumulator}`;
        
        let anaProfitElement = document.getElementById('ana-profit');
        let fixedTotalProfitAmount = totalProfitAmountValue.toFixed(2);
        anaProfitElement.innerText = `₹${fixedTotalProfitAmount}`;
        
        let anaMarginElement = document.getElementById('ana-margin');
        anaMarginElement.innerText = `${marginPercentageString}%`;
        
        let anaStockElement = document.getElementById('ana-stock');
        let totalInventoryUnitsCount = 0;
        
        for (let k = 0; k < allInventory.length; k++) {
            let loopInventoryItem = allInventory[k];
            let loopInventoryItemQty = loopInventoryItem.qty;
            let parsedInventoryItemQty = Number(loopInventoryItemQty);
            if (!isNaN(parsedInventoryItemQty)) {
                totalInventoryUnitsCount = totalInventoryUnitsCount + parsedInventoryItemQty;
            }
        }
        
        anaStockElement.innerText = totalInventoryUnitsCount;
    }

    let totalInventoryValueAccumulator = 0;
    let inventoryStatsKeysArray = Object.keys(itemStatsMapObject);
    let inventoryStatsValuesArray = [];
    
    for (let m = 0; m < inventoryStatsKeysArray.length; m++) {
        let currentItemKeyString = inventoryStatsKeysArray[m];
        let currentItemStatsObject = itemStatsMapObject[currentItemKeyString];
        let currentItemTotalValue = currentItemStatsObject.vv;
        
        totalInventoryValueAccumulator = totalInventoryValueAccumulator + currentItemTotalValue;
        
        let payloadObject = {
            n: currentItemKeyString,
            v: currentItemTotalValue
        };
        
        inventoryStatsValuesArray.push(payloadObject);
    }
    
    inventoryStatsValuesArray.sort(function(a, b) {
        return b.v - a.v;
    });
    
    let abcTotalsObject = {
        A: 0,
        B: 0,
        C: 0
    };
    
    let abcHtmlContentStringArray = [];
    let cumulativeValueAccumulator = 0;
    
    for (let n = 0; n < inventoryStatsValuesArray.length; n++) {
        let currentInventoryStatObject = inventoryStatsValuesArray[n];
        let currentInventoryStatValue = currentInventoryStatObject.v;
        
        cumulativeValueAccumulator = cumulativeValueAccumulator + currentInventoryStatValue;
        
        let cumulativePercentageValue = 0;
        if (totalInventoryValueAccumulator > 0) {
            cumulativePercentageValue = cumulativeValueAccumulator / totalInventoryValueAccumulator;
        }
        
        let abcCategoryClassString = 'C';
        let abcCategoryColorString = 'text-danger';
        
        if (cumulativePercentageValue <= 0.7) {
            let currentATotal = abcTotalsObject.A;
            let updatedATotal = currentATotal + currentInventoryStatValue;
            abcTotalsObject.A = updatedATotal;
            
            abcCategoryClassString = 'A';
            abcCategoryColorString = 'text-success';
        } else if (cumulativePercentageValue <= 0.9) {
            let currentBTotal = abcTotalsObject.B;
            let updatedBTotal = currentBTotal + currentInventoryStatValue;
            abcTotalsObject.B = updatedBTotal;
            
            abcCategoryClassString = 'B';
            abcCategoryColorString = 'text-warning';
        } else {
            let currentCTotal = abcTotalsObject.C;
            let updatedCTotal = currentCTotal + currentInventoryStatValue;
            abcTotalsObject.C = updatedCTotal;
        }
        
        let currentItemNameString = currentInventoryStatObject.n;
        let fixedStatValueString = currentInventoryStatValue.toFixed(2);
        let fixedPercentageValueString = (cumulativePercentageValue * 100).toFixed(1);
        
        let abcRowHtmlString = `
            <tr>
                <td class="py-2 px-4 truncate max-w-xs">${currentItemNameString}</td>
                <td class="py-2 px-4">₹${fixedStatValueString}</td>
                <td class="py-2 px-4 font-mono">${fixedPercentageValueString}%</td>
                <td class="py-2 px-4 font-black ${abcCategoryColorString}">${abcCategoryClassString}</td>
            </tr>
        `;
        
        abcHtmlContentStringArray.push(abcRowHtmlString);
    }
    
    let tableAbcTbodyElement = document.querySelector('#table-abc tbody');
    if (tableAbcTbodyElement) {
        let joinedAbcHtmlContent = abcHtmlContentStringArray.join('');
        tableAbcTbodyElement.innerHTML = joinedAbcHtmlContent;
    }
    
    let filterTopSellingInputElement = document.getElementById('filter-top-selling');
    let filterTopSellingValueString = "";
    if (filterTopSellingInputElement) {
        filterTopSellingValueString = filterTopSellingInputElement.value;
    }
    
    let topSellingHtmlContentStringArray = [];
    let topSellingKeysArray = Object.keys(itemStatsMapObject);
    let topSellingValuesArray = [];
    
    for (let p = 0; p < topSellingKeysArray.length; p++) {
        let currentKeyString = topSellingKeysArray[p];
        let currentStatsObject = itemStatsMapObject[currentKeyString];
        let currentQtySoldValue = currentStatsObject.qS;
        
        let payloadObject = {
            n: currentKeyString,
            sq: currentQtySoldValue
        };
        
        topSellingValuesArray.push(payloadObject);
    }
    
    topSellingValuesArray.sort(function(a, b) {
        return b.sq - a.sq;
    });
    
    if (filterTopSellingValueString === 'Top10') {
        topSellingValuesArray = topSellingValuesArray.slice(0, 10);
    }
    
    for (let q = 0; q < topSellingValuesArray.length; q++) {
        let currentTopSellingObject = topSellingValuesArray[q];
        let currentQtySoldValue = currentTopSellingObject.sq;
        let currentItemNameString = currentTopSellingObject.n;
        
        let isQtyGreaterThanZero = currentQtySoldValue > 0;
        let isFilterAll = filterTopSellingValueString === 'All';
        
        let isConditionMet = false;
        if (isQtyGreaterThanZero === true) {
            isConditionMet = true;
        } else if (isFilterAll === true) {
            isConditionMet = true;
        }
        
        if (isConditionMet === true) {
            let rowHtmlString = `
                <tr>
                    <td class="py-1.5 px-3 truncate max-w-[200px] text-[13px] font-medium" title="${currentItemNameString}">${currentItemNameString}</td>
                    <td class="py-1.5 px-3 font-mono font-bold text-right text-success">
                        <span class="bg-success/10 px-2 py-0.5 rounded shadow-sm border border-success/30">${currentQtySoldValue}</span>
                    </td>
                </tr>
            `;
            topSellingHtmlContentStringArray.push(rowHtmlString);
        }
    }
    
    let tbodyTopSellingElement = document.getElementById('tbody-top-selling');
    if (tbodyTopSellingElement) {
        let joinedTopSellingHtmlContent = topSellingHtmlContentStringArray.join('');
        tbodyTopSellingElement.innerHTML = joinedTopSellingHtmlContent;
    }
    
    let filterInvStatusInputElement = document.getElementById('filter-inv-status');
    let filterInvStatusValueString = "";
    if (filterInvStatusInputElement) {
        filterInvStatusValueString = filterInvStatusInputElement.value;
    }
    
    let invStatusHtmlContentStringArray = [];
    let invStatusKeysArray = Object.keys(itemStatsMapObject);
    let invStatusValuesArray = [];
    
    for (let r = 0; r < invStatusKeysArray.length; r++) {
        let currentKeyString = invStatusKeysArray[r];
        let currentStatsObject = itemStatsMapObject[currentKeyString];
        let currentStockValue = currentStatsObject.stk;
        
        let payloadObject = {
            n: currentKeyString,
            sk: currentStockValue
        };
        
        invStatusValuesArray.push(payloadObject);
    }
    
    invStatusValuesArray.sort(function(a, b) {
        return a.sk - b.sk;
    });
    
    for (let s = 0; s < invStatusValuesArray.length; s++) {
        let currentInvStatusObject = invStatusValuesArray[s];
        let currentStockValue = currentInvStatusObject.sk;
        let currentItemNameString = currentInvStatusObject.n;
        
        let isLowFilterActive = filterInvStatusValueString === 'Low';
        let isStockGreaterThanThree = currentStockValue > 3;
        
        let shouldSkipIteration = false;
        if (isLowFilterActive === true) {
            if (isStockGreaterThanThree === true) {
                shouldSkipIteration = true;
            }
        }
        
        if (shouldSkipIteration === false) {
            let rowHtmlString = `
                <tr>
                    <td class="py-1.5 px-3 truncate max-w-[200px] text-[13px] font-medium" title="${currentItemNameString}">${currentItemNameString}</td>
                    <td class="py-1.5 px-3 text-right font-mono font-bold text-danger">
                        <span class="bg-red-50 px-2 py-0.5 rounded border shadow-sm">${currentStockValue}</span>
                    </td>
                </tr>
            `;
            invStatusHtmlContentStringArray.push(rowHtmlString);
        }
    }
    
    let tbodyInvStatusElement = document.getElementById('tbody-inv-status');
    if (tbodyInvStatusElement) {
        let joinedInvStatusHtmlContent = invStatusHtmlContentStringArray.join('');
        tbodyInvStatusElement.innerHTML = joinedInvStatusHtmlContent;
    }

    let fsnTotalsObject = {
        F: 0,
        S: 0,
        N: 0
    };
    
    let matrixValuesArray = [];
    
    let qtySoldValuesArray = [];
    let revenueValuesArray = [];
    
    let statsKeysArray = Object.keys(itemStatsMapObject);
    for (let t = 0; t < statsKeysArray.length; t++) {
        let currentKeyString = statsKeysArray[t];
        let currentStatsObject = itemStatsMapObject[currentKeyString];
        
        let currentQtySoldValue = currentStatsObject.qS;
        qtySoldValuesArray.push(currentQtySoldValue);
        
        let currentRevenueValue = currentStatsObject.rr;
        revenueValuesArray.push(currentRevenueValue);
    }
    
    let maxQtySoldValue = Math.max(...qtySoldValuesArray, 0);
    let maxRevenueValue = Math.max(...revenueValuesArray, 0);
    
    for (let u = 0; u < statsKeysArray.length; u++) {
        let currentKeyString = statsKeysArray[u];
        let currentStatsObject = itemStatsMapObject[currentKeyString];
        
        let fsnCategoryString = 'N';
        let currentQtySoldValue = currentStatsObject.qS;
        
        if (currentQtySoldValue > 0) {
            let halfMaxQtySoldValue = maxQtySoldValue * 0.5;
            if (currentQtySoldValue >= halfMaxQtySoldValue) {
                fsnCategoryString = 'F';
            } else {
                fsnCategoryString = 'S';
            }
        }
        
        let currentStockValue = currentStatsObject.stk;
        let currentFsnTotal = fsnTotalsObject[fsnCategoryString];
        let updatedFsnTotal = currentFsnTotal + currentStockValue;
        fsnTotalsObject[fsnCategoryString] = updatedFsnTotal;
        
        let hmvCategoryString = 'V';
        let currentRevenueValue = currentStatsObject.rr;
        
        if (currentRevenueValue > 0) {
            let halfMaxRevenueValue = maxRevenueValue * 0.5;
            if (currentRevenueValue >= halfMaxRevenueValue) {
                hmvCategoryString = 'H';
            } else {
                hmvCategoryString = 'M';
            }
        }
        
        let classificationString = "";
        
        if (fsnCategoryString === 'F') {
            if (hmvCategoryString === 'H') {
                classificationString = "⭐ Stars";
            } else if (hmvCategoryString === 'M') {
                classificationString = "🚀 Drivers";
            } else if (hmvCategoryString === 'V') {
                classificationString = "🏃 Runners";
            }
        } else if (fsnCategoryString === 'S') {
            if (hmvCategoryString === 'H') {
                classificationString = "💰 Cash Cows";
            } else if (hmvCategoryString === 'M') {
                classificationString = "🐢 Slugs";
            } else if (hmvCategoryString === 'V') {
                classificationString = "📦 Basics";
            }
        } else if (fsnCategoryString === 'N') {
            if (hmvCategoryString === 'H') {
                classificationString = "🔥 Dead Weight";
            } else if (hmvCategoryString === 'M') {
                classificationString = "💤 Sleepers";
            } else if (hmvCategoryString === 'V') {
                classificationString = "🗑️ Dead Stock";
            }
        }
        
        let currentTotalValue = currentStatsObject.vv;
        
        let payloadObject = {
            n: currentKeyString,
            s: currentStockValue,
            v: currentTotalValue,
            r: currentRevenueValue,
            F: fsnCategoryString,
            H: hmvCategoryString,
            C: classificationString
        };
        
        matrixValuesArray.push(payloadObject);
    }
    
    let anaClassFilterInputElement = document.getElementById('ana-class-filter');
    let anaClassFilterValueString = "";
    if (anaClassFilterInputElement) {
        anaClassFilterValueString = anaClassFilterInputElement.value;
    }
    
    let matrixHtmlContentStringArray = [];
    
    matrixValuesArray.sort(function(a, b) {
        return b.r - a.r;
    });
    
    for (let v = 0; v < matrixValuesArray.length; v++) {
        let currentMatrixObject = matrixValuesArray[v];
        let currentClassificationString = currentMatrixObject.C;
        
        let isFilterAll = anaClassFilterValueString === "All";
        let doesIncludeClassification = currentClassificationString.includes(anaClassFilterValueString);
        
        let shouldSkipIteration = false;
        if (isFilterAll === false) {
            if (doesIncludeClassification === false) {
                shouldSkipIteration = true;
            }
        }
        
        if (shouldSkipIteration === false) {
            let fsnCategoryString = currentMatrixObject.F;
            let fsnColorClassString = "";
            if (fsnCategoryString === 'F') {
                fsnColorClassString = 'text-success';
            } else if (fsnCategoryString === 'S') {
                fsnColorClassString = 'text-warning';
            } else {
                fsnColorClassString = 'text-danger';
            }
            
            let hmvCategoryString = currentMatrixObject.H;
            let hmvColorClassString = "";
            if (hmvCategoryString === 'H') {
                hmvColorClassString = 'text-primary';
            } else if (hmvCategoryString === 'M') {
                hmvColorClassString = 'text-purple-500';
            } else {
                hmvColorClassString = 'text-gray-400';
            }
            
            let currentItemNameString = currentMatrixObject.n;
            let currentStockValue = currentMatrixObject.s;
            
            let currentTotalValue = currentMatrixObject.v;
            let fixedTotalValueString = currentTotalValue.toFixed(2);
            
            let currentRevenueValue = currentMatrixObject.r;
            let fixedRevenueValueString = currentRevenueValue.toFixed(2);
            
            let rowHtmlString = `
                <tr class="border-b dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800 transition">
                    <td class="py-3 px-4 font-bold text-sm tracking-tight truncate max-w-xs" title="${currentItemNameString}">${currentItemNameString}</td>
                    <td class="py-3 px-4 font-mono font-medium text-center">${currentStockValue}</td>
                    <td class="py-3 px-4 font-mono tracking-tight text-right text-gray-500 dark:text-gray-400">₹${fixedTotalValueString}</td>
                    <td class="py-3 px-4 font-mono font-bold text-success text-right tracking-tight">₹${fixedRevenueValueString}</td>
                    <td class="py-3 px-4 font-bold text-center ${fsnColorClassString}">${fsnCategoryString}</td>
                    <td class="py-3 px-4 font-bold text-center ${hmvColorClassString}">${hmvCategoryString}</td>
                    <td class="py-3 px-4 font-semibold text-[13px] text-gray-700 dark:text-gray-200">
                        <span class="bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded shadow-sm">${currentClassificationString}</span>
                    </td>
                </tr>
            `;
            
            matrixHtmlContentStringArray.push(rowHtmlString);
        }
    }
    
    let tableMatrixTbodyElement = document.querySelector('#table-matrix tbody');
    if (tableMatrixTbodyElement) {
        let joinedMatrixHtmlContent = matrixHtmlContentStringArray.join('');
        tableMatrixTbodyElement.innerHTML = joinedMatrixHtmlContent;
    }

    lastMonthlyData = monthlyStatsMapObject;
    lastAbcTotals = abcTotalsObject;
    lastFsnTotals = fsnTotalsObject;
    
    renderCharts(monthlyStatsMapObject, abcTotalsObject, fsnTotalsObject);
}

function renderCharts(monthlyDataMapObject, abcTotalsObject, fsnTotalsObject) {
    if (!window.Chart) {
        return;
    }
    
    if (myChartMonthly) {
        myChartMonthly.destroy();
    }
    if (myChartABC) {
        myChartABC.destroy();
    }
    if (myChartFSN) {
        myChartFSN.destroy();
    }
    
    let isDarkModeActive = document.body.classList.contains('dark-mode');
    let chartColorString = '#334155';
    if (isDarkModeActive === true) {
        chartColorString = '#e2e8f0';
    }
    
    Chart.defaults.color = chartColorString;
    Chart.defaults.font.family = 'Inter';
    
    let monthlyDataKeysArray = Object.keys(monthlyDataMapObject);
    let reversedMonthlyDataKeysArray = monthlyDataKeysArray.reverse();
    
    let salesDataArray = [];
    let profitDataArray = [];
    
    for (let i = 0; i < reversedMonthlyDataKeysArray.length; i++) {
        let currentKeyString = reversedMonthlyDataKeysArray[i];
        let currentMonthObject = monthlyDataMapObject[currentKeyString];
        
        let currentSalesValue = currentMonthObject.ss;
        salesDataArray.push(currentSalesValue);
        
        let currentProfitValue = currentMonthObject.pp;
        profitDataArray.push(currentProfitValue);
    }
    
    let chartMonthlyElement = document.getElementById('chart-monthly');
    if (chartMonthlyElement) {
        let labelsArray = ["No Tx Found..."];
        let keysCount = reversedMonthlyDataKeysArray.length;
        if (keysCount > 0) {
            labelsArray = reversedMonthlyDataKeysArray;
        }
        
        let configObject = {
            type: 'bar',
            data: {
                labels: labelsArray,
                datasets: [
                    {
                        label: "Sale Velocity (₹)",
                        data: salesDataArray,
                        backgroundColor: "rgba(99, 102, 241, 0.8)",
                        borderRadius: 4,
                        borderSkipped: false
                    },
                    {
                        label: "Net Extraction (₹)",
                        data: profitDataArray,
                        backgroundColor: "rgba(16, 185, 129, 0.8)",
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Monthly Vol.'
                    }
                },
                animation: {
                    duration: 0
                }
            }
        };
        
        myChartMonthly = new Chart(chartMonthlyElement, configObject);
    }
    
    let chartAbcElement = document.getElementById('chart-abc');
    if (chartAbcElement) {
        let aTotalValue = abcTotalsObject.A;
        let bTotalValue = abcTotalsObject.B;
        let cTotalValue = abcTotalsObject.C;
        
        let configObject = {
            type: 'doughnut',
            data: {
                labels: ['A (70%)', 'B (20%)', 'C (10%)'],
                datasets: [
                    {
                        data: [aTotalValue, bTotalValue, cTotalValue],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }
                ]
            },
            options: {
                responsive: true,
                cutout: '70%',
                plugins: {
                    title: {
                        display: true,
                        text: 'ABC Value'
                    }
                },
                animation: {
                    duration: 0
                }
            }
        };
        
        myChartABC = new Chart(chartAbcElement, configObject);
    }
    
    let chartFsnElement = document.getElementById('chart-fsn');
    if (chartFsnElement) {
        let fTotalValue = fsnTotalsObject.F;
        let sTotalValue = fsnTotalsObject.S;
        let nTotalValue = fsnTotalsObject.N;
        
        let configObject = {
            type: 'pie',
            data: {
                labels: ['Fast', 'Slow', 'Non-Moving'],
                datasets: [
                    {
                        data: [fTotalValue, sTotalValue, nTotalValue],
                        backgroundColor: ['#3b82f6', '#f59e0b', '#9ca3af'],
                        borderWidth: 0
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'FSN Units'
                    }
                },
                animation: {
                    duration: 0
                }
            }
        };
        
        myChartFSN = new Chart(chartFsnElement, configObject);
    }
}

function updateInventoryStats() {
    let totalItemsCountValue = 0;
    let totalValueAccumulatorValue = 0;
    let outOfStockCountValue = 0;
    let lowStockCountValue = 0;
    
    for (let i = 0; i < allInventory.length; i++) {
        let currentInventoryItem = allInventory[i];
        let currentItemQtyValue = currentInventoryItem.qty;
        let currentItemPriceValue = currentInventoryItem.price;
        
        let currentItemTotalValue = currentItemQtyValue * currentItemPriceValue;
        
        totalItemsCountValue++;
        totalValueAccumulatorValue = totalValueAccumulatorValue + currentItemTotalValue;
        
        if (currentItemQtyValue === 0) {
            outOfStockCountValue++;
        } else if (currentItemQtyValue <= 3) {
            lowStockCountValue++;
        }
    }
    
    let statInvTotalElement = document.getElementById('stat-inv-total');
    if (statInvTotalElement) {
        statInvTotalElement.innerText = totalItemsCountValue;
        
        let statInvValueElement = document.getElementById('stat-inv-value');
        let fixedTotalValueString = totalValueAccumulatorValue.toFixed(2);
        statInvValueElement.innerText = `₹${fixedTotalValueString}`;
        
        let statInvOutElement = document.getElementById('stat-inv-out');
        statInvOutElement.innerText = outOfStockCountValue;
        
        let statInvLowElement = document.getElementById('stat-inv-low');
        statInvLowElement.innerText = lowStockCountValue;
    }
}

function renderInventoryTable() {
    let tbodyElement = document.querySelector('#table-inventory tbody');
    if (!tbodyElement) {
        return;
    }
    
    let searchStringLower = currentInventorySearch.toLowerCase();
    let htmlContentString = "";
    
    let filteredInventoryArray = [];
    
    for (let i = 0; i < allInventory.length; i++) {
        let currentInventoryItem = allInventory[i];
        let currentItemNameString = String(currentInventoryItem.name);
        let lowerItemNameString = currentItemNameString.toLowerCase();
        
        let currentItemPartNumberString = String(currentInventoryItem.partNumber || '');
        let lowerItemPartNumberString = currentItemPartNumberString.toLowerCase();
        
        let doesNameInclude = lowerItemNameString.includes(searchStringLower);
        let doesPartNumberInclude = lowerItemPartNumberString.includes(searchStringLower);
        
        let isSearchMatch = false;
        if (doesNameInclude === true) {
            isSearchMatch = true;
        } else if (doesPartNumberInclude === true) {
            isSearchMatch = true;
        }
        
        let isSearchValid = searchStringLower !== "";
        let shouldExcludeBySearch = false;
        
        if (isSearchValid === true) {
            if (isSearchMatch === false) {
                shouldExcludeBySearch = true;
            }
        }
        
        if (shouldExcludeBySearch === false) {
            let currentItemQtyValue = currentInventoryItem.qty;
            
            let isOutFilterActive = currentInventoryFilter === 'out';
            let isItemNotOut = currentItemQtyValue !== 0;
            
            let shouldExcludeByOutFilter = false;
            if (isOutFilterActive === true) {
                if (isItemNotOut === true) {
                    shouldExcludeByOutFilter = true;
                }
            }
            
            if (shouldExcludeByOutFilter === false) {
                let isLowFilterActive = currentInventoryFilter === 'low';
                let isItemNotLow = false;
                
                if (currentItemQtyValue === 0) {
                    isItemNotLow = true;
                } else if (currentItemQtyValue > 3) {
                    isItemNotLow = true;
                }
                
                let shouldExcludeByLowFilter = false;
                if (isLowFilterActive === true) {
                    if (isItemNotLow === true) {
                        shouldExcludeByLowFilter = true;
                    }
                }
                
                if (shouldExcludeByLowFilter === false) {
                    filteredInventoryArray.push(currentInventoryItem);
                }
            }
        }
    }
    
    let filteredItemsCount = filteredInventoryArray.length;
    
    if (filteredItemsCount === 0) {
        let noItemsHtmlString = `<tr><td colspan="6" class="p-4 text-center text-sm text-gray-500">No Inventory Found.</td></tr>`;
        tbodyElement.innerHTML = noItemsHtmlString;
        return;
    }
    
    for (let j = 0; j < filteredInventoryArray.length; j++) {
        let currentFilteredItem = filteredInventoryArray[j];
        let currentItemQtyValue = currentFilteredItem.qty;
        
        let badgeHtmlString = "";
        
        if (currentItemQtyValue === 0) {
            badgeHtmlString = `<span class="bg-red-50 text-danger border border-red-200 px-2 py-0.5 rounded text-xs font-bold shadow-sm">Out of Stock</span>`;
        } else if (currentItemQtyValue <= 3) {
            badgeHtmlString = `<span class="bg-warning/10 text-warning border border-warning/20 px-2 py-0.5 rounded text-xs font-bold shadow-sm">Low Stock</span>`;
        } else {
            badgeHtmlString = `<span class="bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded text-xs font-bold shadow-sm">In Stock</span>`;
        }
        
        let gstHtmlString = "";
        let hasGstFlag = currentFilteredItem.hasGST;
        
        if (hasGstFlag === true) {
            gstHtmlString = `<span class="bg-indigo-50 border border-indigo-100 text-indigo-500 text-[9px] px-1 rounded ml-1 font-bold">GST</span>`;
        }
        
        let partNumberHtmlString = "";
        let itemPartNumberString = currentFilteredItem.partNumber;
        
        if (itemPartNumberString) {
            partNumberHtmlString = `<span class="block text-[10px] text-gray-400 font-mono mt-0.5">PN: ${itemPartNumberString}</span>`;
        }
        
        let currentItemNameString = currentFilteredItem.name;
        let currentItemPriceValue = currentFilteredItem.price;
        let parsedItemPriceValue = Number(currentItemPriceValue);
        let fixedItemPriceString = parsedItemPriceValue.toFixed(2);
        
        let currentItemTotalValue = currentItemQtyValue * currentItemPriceValue;
        let fixedItemTotalString = currentItemTotalValue.toFixed(2);
        
        let currentItemIdString = currentFilteredItem.id;
        
        let rowHtmlString = `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b dark:border-gray-700/50">
                <td class="p-3">
                    <div class="text-[13px] font-bold tracking-tight">${currentItemNameString} ${gstHtmlString}</div>
                    ${partNumberHtmlString}
                </td>
                <td class="p-3 text-right font-mono font-bold">${currentItemQtyValue}</td>
                <td class="p-3 text-right font-mono text-gray-500 dark:text-gray-400">₹${fixedItemPriceString}</td>
                <td class="p-3 text-right font-mono font-bold text-success">₹${fixedItemTotalString}</td>
                <td class="p-3 text-right">${badgeHtmlString}</td>
                <td class="p-3 text-right">
                    <div class="flex gap-2 justify-end">
                        <button class="btn-edit-inv text-gray-400 hover:text-primary transition" data-id="${currentItemIdString}">
                            <i class="fa-solid fa-pen pointer-events-none"></i>
                        </button>
                        <button class="btn-del-inv text-gray-400 hover:text-danger transition" data-id="${currentItemIdString}">
                            <i class="fa-solid fa-xmark pointer-events-none"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        
        htmlContentString = htmlContentString + rowHtmlString;
    }
    
    tbodyElement.innerHTML = htmlContentString;
}

let searchInventoryInputElement = document.getElementById('search-inventory');
if (searchInventoryInputElement) {
    searchInventoryInputElement.addEventListener('input', function(event) {
        let inputValueString = event.target.value;
        currentInventorySearch = inputValueString;
        renderInventoryTable();
    });
}

let allInvTabButtons = document.querySelectorAll('.inv-tab');
for (let i = 0; i < allInvTabButtons.length; i++) {
    let currentTabButton = allInvTabButtons[i];
    
    currentTabButton.addEventListener('click', function(event) {
        let activeTabButtons = document.querySelectorAll('.inv-tab');
        
        for (let j = 0; j < activeTabButtons.length; j++) {
            let iterTabButton = activeTabButtons[j];
            iterTabButton.classList.remove('active');
            iterTabButton.classList.remove('bg-white');
            iterTabButton.classList.remove('text-primary');
        }
        
        let targetButtonElement = event.target;
        targetButtonElement.classList.add('active');
        targetButtonElement.classList.add('bg-white');
        targetButtonElement.classList.add('text-primary');
        
        let dataFilterValueString = targetButtonElement.getAttribute('data-filter');
        currentInventoryFilter = dataFilterValueString;
        
        renderInventoryTable();
    });
}

let formInventoryElement = document.getElementById('form-inventory');

if (formInventoryElement) {
    formInventoryElement.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        let invNameInputElement = document.getElementById('inv-name');
        let rawInvNameString = invNameInputElement.value;
        let finalInvNameString = rawInvNameString.trim();
        
        let invPartInputElement = document.getElementById('inv-part');
        let rawInvPartString = invPartInputElement.value;
        let finalInvPartString = rawInvPartString.trim();
        
        let invQtyInputElement = document.getElementById('inv-qty');
        let rawInvQtyString = invQtyInputElement.value;
        let parsedInvQtyFloat = parseFloat(rawInvQtyString);
        let finalInvQtyFloat = 0;
        if (!isNaN(parsedInvQtyFloat)) {
            finalInvQtyFloat = parsedInvQtyFloat;
        }
        
        let invPriceInputElement = document.getElementById('inv-price');
        let rawInvPriceString = invPriceInputElement.value;
        let parsedInvPriceFloat = parseFloat(rawInvPriceString);
        let finalInvPriceFloat = 0;
        if (!isNaN(parsedInvPriceFloat)) {
            finalInvPriceFloat = parsedInvPriceFloat;
        }
        
        let invGstCheckboxElement = document.getElementById('inv-gst');
        let isInvGstChecked = invGstCheckboxElement.checked;
        
        let editIdValueString = formInventoryElement.getAttribute('data-edit-id');
        
        if (editIdValueString) {
            let inventoryDocumentReference = doc(db, "inventory", editIdValueString);
            
            let updatePayloadObject = {
                name: finalInvNameString,
                partNumber: finalInvPartString,
                qty: finalInvQtyFloat,
                price: finalInvPriceFloat,
                hasGST: isInvGstChecked
            };
            
            await updateDoc(inventoryDocumentReference, updatePayloadObject);
            
            let successMessageString = 'Updated!';
            showSuccessAnimation(successMessageString);
            
        } else {
            let inventoryCollectionReference = collection(db, "inventory");
            
            let createPayloadObject = {
                name: finalInvNameString,
                partNumber: finalInvPartString,
                qty: finalInvQtyFloat,
                price: finalInvPriceFloat,
                hasGST: isInvGstChecked,
                hsn: ""
            };
            
            await addDoc(inventoryCollectionReference, createPayloadObject);
            
            let successMessageString = 'Added!';
            showSuccessAnimation(successMessageString);
        }
        
        resetInventoryForm();
    });
}

function resetInventoryForm() {
    let formInventoryElement = document.getElementById('form-inventory');
    if (formInventoryElement) {
        formInventoryElement.reset();
        formInventoryElement.removeAttribute('data-edit-id');
    }
    
    let btnInvSubmitElement = document.getElementById('btn-inv-submit');
    if (btnInvSubmitElement) {
        btnInvSubmitElement.innerText = "Save";
    }
    
    let btnInvCancelElement = document.getElementById('btn-inv-cancel');
    if (btnInvCancelElement) {
        btnInvCancelElement.style.display = 'none';
    }
    
    let invFormTitleElement = document.getElementById('inv-form-title');
    if (invFormTitleElement) {
        invFormTitleElement.innerText = "Add Item";
    }
}

let btnInvCancelElement = document.getElementById('btn-inv-cancel');
if (btnInvCancelElement) {
    btnInvCancelElement.addEventListener('click', function() {
        resetInventoryForm();
    });
}

let tableInventoryTbodyElement = document.querySelector('#table-inventory tbody');

if (tableInventoryTbodyElement) {
    tableInventoryTbodyElement.addEventListener('click', async function(event) {
        let targetElement = event.target;
        
        let deleteButtonElement = targetElement.closest('.btn-del-inv');
        if (deleteButtonElement) {
            let confirmMessageString = 'Delete item?';
            let isConfirmed = confirm(confirmMessageString);
            
            if (isConfirmed === true) {
                let dataIdString = deleteButtonElement.getAttribute('data-id');
                let inventoryDocumentReference = doc(db, "inventory", dataIdString);
                await deleteDoc(inventoryDocumentReference);
            }
            return;
        }
        
        let editButtonElement = targetElement.closest('.btn-edit-inv');
        if (editButtonElement) {
            let dataIdString = editButtonElement.getAttribute('data-id');
            let targetInventoryItem = null;
            
            for (let i = 0; i < allInventory.length; i++) {
                let currentInventoryItem = allInventory[i];
                let currentInventoryId = currentInventoryItem.id;
                
                if (currentInventoryId === dataIdString) {
                    targetInventoryItem = currentInventoryItem;
                    break;
                }
            }
            
            if (targetInventoryItem !== null) {
                let invNameInputElement = document.getElementById('inv-name');
                if (invNameInputElement) {
                    invNameInputElement.value = targetInventoryItem.name;
                }
                
                let invPartInputElement = document.getElementById('inv-part');
                if (invPartInputElement) {
                    let partNumberValue = targetInventoryItem.partNumber;
                    if (!partNumberValue) {
                        partNumberValue = '';
                    }
                    invPartInputElement.value = partNumberValue;
                }
                
                let invQtyInputElement = document.getElementById('inv-qty');
                if (invQtyInputElement) {
                    invQtyInputElement.value = targetInventoryItem.qty;
                }
                
                let invPriceInputElement = document.getElementById('inv-price');
                if (invPriceInputElement) {
                    invPriceInputElement.value = targetInventoryItem.price;
                }
                
                let invGstCheckboxElement = document.getElementById('inv-gst');
                if (invGstCheckboxElement) {
                    invGstCheckboxElement.checked = targetInventoryItem.hasGST;
                }
                
                let formInventoryElement = document.getElementById('form-inventory');
                if (formInventoryElement) {
                    formInventoryElement.setAttribute('data-edit-id', targetInventoryItem.id);
                }
                
                let btnInvSubmitElement = document.getElementById('btn-inv-submit');
                if (btnInvSubmitElement) {
                    btnInvSubmitElement.innerText = "Update";
                }
                
                let btnInvCancelElement = document.getElementById('btn-inv-cancel');
                if (btnInvCancelElement) {
                    btnInvCancelElement.style.display = 'block';
                }
                
                let invFormTitleElement = document.getElementById('inv-form-title');
                if (invFormTitleElement) {
                    invFormTitleElement.innerText = "Edit Item";
                }
                
                let scrollOptionsObject = {
                    top: 0,
                    behavior: 'smooth'
                };
                window.scrollTo(scrollOptionsObject);
            }
        }
    });
}

let btnExportGstElement = document.getElementById('btn-export-gst');

if (btnExportGstElement) {
    btnExportGstElement.addEventListener('click', function() {
        let gstExportStartElement = document.getElementById('gst-export-start');
        let startValueString = "";
        if (gstExportStartElement) {
            startValueString = gstExportStartElement.value;
        }
        
        let gstExportEndElement = document.getElementById('gst-export-end');
        let endValueString = "";
        if (gstExportEndElement) {
            endValueString = gstExportEndElement.value;
        }
        
        let isStartEmpty = startValueString === "";
        let isEndEmpty = endValueString === "";
        
        let isMissingDates = false;
        if (isStartEmpty === true) {
            isMissingDates = true;
        } else if (isEndEmpty === true) {
            isMissingDates = true;
        }
        
        if (isMissingDates === true) {
            alert('Select dates');
            return;
        }
        
        let formattedStartString = startValueString + 'T00:00:00';
        let startDateObject = new Date(formattedStartString);
        
        let formattedEndString = endValueString + 'T23:59:59';
        let endDateObject = new Date(formattedEndString);
        
        let salesExportArray = [];
        let purchasesExportArray = [];
        
        for (let i = 0; i < allTransactions.length; i++) {
            let currentTransactionObject = allTransactions[i];
            let hasGstFlag = currentTransactionObject.hasGST;
            
            if (hasGstFlag === false) {
                continue;
            }
            
            let transactionDateString = currentTransactionObject.date;
            let transactionDateObject = new Date(transactionDateString);
            
            let isBeforeStart = transactionDateObject < startDateObject;
            let isAfterEnd = transactionDateObject > endDateObject;
            
            let isOutOfRange = false;
            if (isBeforeStart === true) {
                isOutOfRange = true;
            } else if (isAfterEnd === true) {
                isOutOfRange = true;
            }
            
            if (isOutOfRange === true) {
                continue;
            }
            
            let formattedLocaleDateString = transactionDateObject.toLocaleDateString('en-GB');
            
            let invoiceValueString = currentTransactionObject.invoice;
            if (!invoiceValueString) {
                invoiceValueString = currentTransactionObject.invoiceNo;
            }
            if (!invoiceValueString) {
                invoiceValueString = "N/A";
            }
            
            let partyValueString = currentTransactionObject.supplier;
            if (!partyValueString) {
                partyValueString = currentTransactionObject.customerName;
            }
            if (!partyValueString) {
                partyValueString = "Cash";
            }
            
            let gstinValueString = currentTransactionObject.supplierGstin;
            if (!gstinValueString) {
                gstinValueString = currentTransactionObject.customerGstin;
            }
            if (!gstinValueString) {
                gstinValueString = "";
            }
            
            let itemValueString = currentTransactionObject.item;
            
            let hsnValueString = currentTransactionObject.hsn;
            if (!hsnValueString) {
                hsnValueString = "";
            }
            
            let qtyValueFloat = currentTransactionObject.qty;
            let taxableValueFloat = currentTransactionObject.taxable;
            
            let cgstValueFloat = currentTransactionObject.cgst;
            if (!cgstValueFloat) {
                cgstValueFloat = 0;
            }
            
            let sgstValueFloat = currentTransactionObject.sgst;
            if (!sgstValueFloat) {
                sgstValueFloat = 0;
            }
            
            let igstValueFloat = currentTransactionObject.igst;
            if (!igstValueFloat) {
                igstValueFloat = 0;
            }
            
            let totalAmountValueFloat = currentTransactionObject.amount;
            
            let exportRowObject = {
                "Date": formattedLocaleDateString,
                "Invoice": invoiceValueString,
                "Party": partyValueString,
                "GSTIN": gstinValueString,
                "Item": itemValueString,
                "HSN": hsnValueString,
                "Qty": qtyValueFloat,
                "Taxable Value": taxableValueFloat,
                "CGST": cgstValueFloat,
                "SGST": sgstValueFloat,
                "IGST": igstValueFloat,
                "Total": totalAmountValueFloat
            };
            
            let transactionTypeString = currentTransactionObject.type;
            
            if (transactionTypeString === 'Sale') {
                salesExportArray.push(exportRowObject);
            } else if (transactionTypeString === 'Purchase') {
                purchasesExportArray.push(exportRowObject);
            }
        }
        
        let salesCountValue = salesExportArray.length;
        let purchasesCountValue = purchasesExportArray.length;
        
        let isSalesEmpty = salesCountValue === 0;
        let isPurchasesEmpty = purchasesCountValue === 0;
        
        let isBothEmpty = false;
        if (isSalesEmpty === true) {
            if (isPurchasesEmpty === true) {
                isBothEmpty = true;
            }
        }
        
        if (isBothEmpty === true) {
            alert('No GST transactions found.');
            return;
        }
        
        let excelWorkbookObject = XLSX.utils.book_new();
        
        if (isSalesEmpty === false) {
            let salesWorksheetObject = XLSX.utils.json_to_sheet(salesExportArray);
            XLSX.utils.book_append_sheet(excelWorkbookObject, salesWorksheetObject, "Sales_GST");
        }
        
        if (isPurchasesEmpty === false) {
            let purchasesWorksheetObject = XLSX.utils.json_to_sheet(purchasesExportArray);
            XLSX.utils.book_append_sheet(excelWorkbookObject, purchasesWorksheetObject, "Purchases_GST");
        }
        
        let exportFileNameString = `GST_Report_${startValueString}.xlsx`;
        XLSX.writeFile(excelWorkbookObject, exportFileNameString);
    });
}

let btnTriggerExcelElement = document.getElementById('btn-trigger-excel');

if (btnTriggerExcelElement) {
    btnTriggerExcelElement.addEventListener('click', function() {
        let excelFileElement = document.getElementById('excel-file');
        if (excelFileElement) {
            excelFileElement.click();
        }
    });
}

let excelFileElement = document.getElementById('excel-file');

if (excelFileElement) {
    excelFileElement.addEventListener('change', async function(event) {
        let targetFilesArray = event.target.files;
        let uploadedFileObject = targetFilesArray[0];
        
        if (!uploadedFileObject) {
            return;
        }
        
        let confirmMessageString = "WARNING: This replaces entire inventory. Proceed?";
        let isConfirmed = confirm(confirmMessageString);
        
        if (isConfirmed === false) {
            event.target.value = '';
            return;
        }
        
        let btnTriggerExcelElement = document.getElementById('btn-trigger-excel');
        let originalButtonHtmlString = btnTriggerExcelElement.innerHTML;
        
        let processingHtmlString = '<i class="fa-solid fa-spin fa-spinner"></i> Importing';
        btnTriggerExcelElement.innerHTML = processingHtmlString;
        btnTriggerExcelElement.disabled = true;
        
        let fileReaderObject = new FileReader();
        
        fileReaderObject.onload = async function(loadEvent) {
            try {
                let loadEventResultArrayBuffer = loadEvent.target.result;
                let uint8ArrayObject = new Uint8Array(loadEventResultArrayBuffer);
                
                let readOptionsObject = {
                    type: 'array'
                };
                
                let excelWorkbookObject = XLSX.read(uint8ArrayObject, readOptionsObject);
                let firstSheetNameString = excelWorkbookObject.SheetNames[0];
                let firstWorksheetObject = excelWorkbookObject.Sheets[firstSheetNameString];
                
                let parsedJsonArray = XLSX.utils.sheet_to_json(firstWorksheetObject);
                
                for (let i = 0; i < allInventory.length; i++) {
                    let currentInventoryItem = allInventory[i];
                    let inventoryDocumentReference = doc(db, "inventory", currentInventoryItem.id);
                    await deleteDoc(inventoryDocumentReference);
                }
                
                for (let j = 0; j < parsedJsonArray.length; j++) {
                    let currentRowObject = parsedJsonArray[j];
                    
                    let itemNameString = currentRowObject['Name'];
                    if (!itemNameString) {
                        itemNameString = currentRowObject['name'];
                    }
                    if (!itemNameString) {
                        itemNameString = currentRowObject['Particulars'];
                    }
                    
                    if (!itemNameString) {
                        continue;
                    }
                    
                    let trimmedItemNameString = String(itemNameString).trim();
                    
                    let rawQtyValue = currentRowObject['Qty'];
                    if (!rawQtyValue) {
                        rawQtyValue = currentRowObject['qty'];
                    }
                    let parsedQtyFloat = Number(rawQtyValue);
                    let finalQtyFloat = 0;
                    if (!isNaN(parsedQtyFloat)) {
                        finalQtyFloat = parsedQtyFloat;
                    }
                    
                    let rawPriceValue = currentRowObject['Price'];
                    if (!rawPriceValue) {
                        rawPriceValue = currentRowObject['price'];
                    }
                    let parsedPriceFloat = Number(rawPriceValue);
                    let finalPriceFloat = 0;
                    if (!isNaN(parsedPriceFloat)) {
                        finalPriceFloat = parsedPriceFloat;
                    }
                    
                    let rawGstFlag = currentRowObject['GST'];
                    let finalGstFlag = false;
                    if (rawGstFlag) {
                        finalGstFlag = true;
                    }
                    
                    let rawPartNumberString = currentRowObject['PN'];
                    let finalPartNumberString = "";
                    if (rawPartNumberString) {
                        finalPartNumberString = rawPartNumberString;
                    }
                    
                    let rawHsnString = currentRowObject['HSN'];
                    let finalHsnString = "";
                    if (rawHsnString) {
                        finalHsnString = rawHsnString;
                    }
                    
                    let inventoryCollectionReference = collection(db, "inventory");
                    let createPayloadObject = {
                        name: trimmedItemNameString,
                        qty: finalQtyFloat,
                        price: finalPriceFloat,
                        hasGST: finalGstFlag,
                        partNumber: finalPartNumberString,
                        hsn: finalHsnString
                    };
                    
                    await addDoc(inventoryCollectionReference, createPayloadObject);
                }
                
                let successMessageString = 'Import Complete!';
                showSuccessAnimation(successMessageString);
                
            } catch (error) {
                let errorMessageString = error.message;
                let alertMessageString = 'Import Error: ' + errorMessageString;
                alert(alertMessageString);
                
            } finally {
                btnTriggerExcelElement.innerHTML = originalButtonHtmlString;
                btnTriggerExcelElement.disabled = false;
                event.target.value = '';
            }
        };
        
        fileReaderObject.readAsArrayBuffer(uploadedFileObject);
    });
}

let btnMergeDupElement = document.getElementById('btn-merge-dup');

if (btnMergeDupElement) {
    btnMergeDupElement.addEventListener('click', async function() {
        let confirmMessageString = "Scan & Merge identical items?";
        let isConfirmed = confirm(confirmMessageString);
        
        if (isConfirmed === false) {
            return;
        }
        
        let originalButtonHtmlString = btnMergeDupElement.innerHTML;
        
        let processingHtmlString = '<i class="fa-solid fa-spin fa-spinner"></i> Merging';
        btnMergeDupElement.innerHTML = processingHtmlString;
        btnMergeDupElement.disabled = true;
        
        try {
            let itemMapObject = {};
            
            for (let i = 0; i < allInventory.length; i++) {
                let currentInventoryItem = allInventory[i];
                let currentItemNameString = currentInventoryItem.name;
                let trimmedItemNameString = currentItemNameString.trim();
                let lowerItemNameString = trimmedItemNameString.toLowerCase();
                
                let mappedArray = itemMapObject[lowerItemNameString];
                if (!mappedArray) {
                    itemMapObject[lowerItemNameString] = [];
                }
                
                itemMapObject[lowerItemNameString].push(currentInventoryItem);
            }
            
            let mergedDuplicatesCount = 0;
            let itemKeysArray = Object.keys(itemMapObject);
            
            for (let j = 0; j < itemKeysArray.length; j++) {
                let currentKeyString = itemKeysArray[j];
                let mappedItemsArray = itemMapObject[currentKeyString];
                let arrayLengthValue = mappedItemsArray.length;
                
                if (arrayLengthValue > 1) {
                    mergedDuplicatesCount++;
                    
                    let totalQtyAccumulator = 0;
                    let totalPriceAccumulator = 0;
                    
                    let masterInventoryItem = mappedItemsArray[0];
                    let masterInventoryId = masterInventoryItem.id;
                    
                    for (let k = 0; k < mappedItemsArray.length; k++) {
                        let innerMappedItem = mappedItemsArray[k];
                        let itemQtyValue = innerMappedItem.qty;
                        let itemPriceValue = innerMappedItem.price;
                        
                        let itemTotalValue = itemQtyValue * itemPriceValue;
                        
                        totalQtyAccumulator = totalQtyAccumulator + itemQtyValue;
                        totalPriceAccumulator = totalPriceAccumulator + itemTotalValue;
                    }
                    
                    let newAveragePriceValue = 0;
                    if (totalQtyAccumulator > 0) {
                        newAveragePriceValue = totalPriceAccumulator / totalQtyAccumulator;
                    }
                    
                    let inventoryDocumentReference = doc(db, "inventory", masterInventoryId);
                    let updatePayloadObject = {
                        qty: totalQtyAccumulator,
                        price: newAveragePriceValue
                    };
                    
                    await updateDoc(inventoryDocumentReference, updatePayloadObject);
                    
                    for (let m = 1; m < mappedItemsArray.length; m++) {
                        let itemToDelete = mappedItemsArray[m];
                        let deleteDocumentReference = doc(db, "inventory", itemToDelete.id);
                        
                        await deleteDoc(deleteDocumentReference);
                    }
                }
            }
            
            if (mergedDuplicatesCount > 0) {
                let successMessageString = `Merged ${mergedDuplicatesCount} duplicates!`;
                showSuccessAnimation(successMessageString);
            } else {
                alert('No duplicates.');
            }
            
        } catch (error) {
            let errorMessageString = error.message;
            let alertMessageString = 'Error: ' + errorMessageString;
            alert(alertMessageString);
            
        } finally {
            btnMergeDupElement.innerHTML = originalButtonHtmlString;
            btnMergeDupElement.disabled = false;
        }
    });
}
