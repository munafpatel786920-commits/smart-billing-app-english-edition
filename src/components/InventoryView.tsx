/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Boxes, 
  SlidersHorizontal,
  PackagePlus,
  AlertCircle,
  Coins,
  CircleDollarSign
} from 'lucide-react';
import { Product } from '../types';

export const InventoryView: React.FC = () => {
  const { products, invoices, purchases, salesReturns, purchaseReturns, saveProduct, deleteProduct, userRole, formatCurrency, countryConfig, t } = useApp();
  
  // Real-time stock audit metrics calculations
  const productStats = useMemo(() => {
    const stats: Record<string, { purchased: number; purchaseReturned: number; sold: number; salesReturned: number }> = {};
    
    // Initialize stats
    products.forEach(p => {
      stats[p.productId] = { purchased: 0, purchaseReturned: 0, sold: 0, salesReturned: 0 };
    });

    // Aggregate from purchases (Inward stock flow)
    if (purchases && Array.isArray(purchases)) {
      purchases.forEach(pb => {
        if (pb.items && Array.isArray(pb.items)) {
          pb.items.forEach(item => {
            if (stats[item.productId]) {
              stats[item.productId].purchased += (item.qty || 0);
            } else {
              stats[item.productId] = { purchased: item.qty || 0, purchaseReturned: 0, sold: 0, salesReturned: 0 };
            }
          });
        }
      });
    }

    // Aggregate from purchase returns
    if (purchaseReturns && Array.isArray(purchaseReturns)) {
      purchaseReturns.forEach(pr => {
        if (pr.items && Array.isArray(pr.items)) {
          pr.items.forEach(item => {
            if (stats[item.productId]) {
              stats[item.productId].purchaseReturned += (item.qty || 0);
            } else {
              stats[item.productId] = { purchased: 0, purchaseReturned: item.qty || 0, sold: 0, salesReturned: 0 };
            }
          });
        }
      });
    }

    // Aggregate from sales invoices (Outward stock flow)
    if (invoices && Array.isArray(invoices)) {
      invoices.forEach(inv => {
        if (inv.items && Array.isArray(inv.items)) {
          inv.items.forEach(item => {
            if (stats[item.productId]) {
              stats[item.productId].sold += (item.qty || 0);
            } else {
              stats[item.productId] = { purchased: 0, purchaseReturned: 0, sold: item.qty || 0, salesReturned: 0 };
            }
          });
        }
      });
    }

    // Aggregate from sales returns
    if (salesReturns && Array.isArray(salesReturns)) {
      salesReturns.forEach(sr => {
        if (sr.items && Array.isArray(sr.items)) {
          sr.items.forEach(item => {
            if (stats[item.productId]) {
              stats[item.productId].salesReturned += (item.qty || 0);
            } else {
              stats[item.productId] = { purchased: 0, purchaseReturned: 0, sold: 0, salesReturned: item.qty || 0 };
            }
          });
        }
      });
    }

    return stats;
  }, [products, purchases, purchaseReturns, invoices, salesReturns]);

  // Real-time stock valuation metrics calculations
  const stockValuationCost = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.currentStock || 0) * (p.purchasePrice || 0), 0);
  }, [products]);

  const stockValuationSale = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.currentStock || 0) * (p.sellingPrice || 0), 0);
  }, [products]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState<'PCS' | 'KG' | 'LITER' | 'BOX' | 'MTR' | 'SET'>('PCS');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [gstRate, setGstRate] = useState(18); // Default to standard 18%
  const [openingStock, setOpeningStock] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const categories = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ['ALL', ...Array.from(list)];
  }, [products]);

  // Filtering products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.hsnCode.includes(searchQuery) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));

      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleEdit = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategory(prod.category);
    setSku(prod.sku);
    setBarcode(prod.barcode || '');
    setHsnCode(prod.hsnCode);
    setUnit(prod.unit);
    setPurchasePrice(prod.purchasePrice);
    setSellingPrice(prod.sellingPrice);
    setGstRate(prod.gstRate);
    setOpeningStock(prod.openingStock);
    setCurrentStock(prod.currentStock);
    setLowStockThreshold(prod.lowStockThreshold);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku || !hsnCode) {
      alert('Fill all required fields!');
      return;
    }

    try {
      await saveProduct({
        productId: editingProduct?.productId,
        name,
        category,
        sku,
        barcode,
        hsnCode,
        unit,
        purchasePrice,
        sellingPrice,
        gstRate,
        openingStock,
        currentStock: editingProduct ? currentStock : openingStock, // opening stock becomes initial stock
        lowStockThreshold
      });

      alert('Product Master saved!');
      handleCloseForm();
    } catch (err) {
      alert('Save failed. Review roles and rules limits.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete Product: "${name}"?`)) {
      try {
        await deleteProduct(id);
      } catch (err) {
        alert('Permission Denied. Only Admins can delete Master records.');
      }
    }
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingProduct(null);
    setName('');
    setCategory('');
    setSku('');
    setBarcode('');
    setHsnCode('');
    setUnit('PCS');
    setPurchasePrice(0);
    setSellingPrice(0);
    setGstRate(18);
    setOpeningStock(0);
    setCurrentStock(0);
    setLowStockThreshold(5);
  };

  return (
    <div className="space-y-6">
      
      {/* Search Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm">
        
        {/* Left: Input searches */}
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="inp-inventory-search"
            type="text"
            placeholder="Search by SKU, HSN, Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
        </div>

        {/* Categories toggles */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
          {categories.map((cat, idx) => (
            <button
              id={`btn-cat-filter-${idx}`}
              key={idx}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg hover:cursor-pointer shrink-0 transition-colors ${
                selectedCategory === cat 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200'
              }`}
            >
              {cat === 'ALL' ? t('all') : cat}
            </button>
          ))}
        </div>

        {/* Right action button */}
        <button
          id="btn-inventory-add-product"
          onClick={() => { handleCloseForm(); setShowAddForm(true); }}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl hover:cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10"
        >
          <Plus className="w-4 h-4" />
          {t('addProduct')}
        </button>

      </div>

      {/* Dynamic Stock Audit Summary Belt */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block">Product Variants</span>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              {products.length} <span className="text-xs text-gray-400 font-normal">lines</span>
            </p>
          </div>
          <span className="text-[9px] text-gray-405 mt-2 block">Catalogued items active</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Total Inward (Purchased)</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {(Object.values(productStats) as { purchased: number; sold: number }[]).reduce((acc, curr) => acc + curr.purchased, 0)} <span className="text-xs text-emerald-600/75 dark:text-emerald-400/75 font-normal">Units</span>
            </p>
          </div>
          <span className="text-[9px] text-gray-405 mt-2 block">Procured via Purchase Bills</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider block">Total Outward (Sold)</span>
            <p className="text-2xl font-black text-indigo-650 dark:text-indigo-400 mt-1">
              {(Object.values(productStats) as { purchased: number; sold: number }[]).reduce((acc, curr) => acc + curr.sold, 0)} <span className="text-xs text-indigo-650/75 dark:text-indigo-450/75 font-normal">Units</span>
            </p>
          </div>
          <span className="text-[9px] text-gray-405 mt-2 block">Dispatched via Sales Invoices</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider block">In-Stock Balance</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {products.reduce((acc, curr) => acc + (curr.currentStock || 0), 0)} <span className="text-xs text-gray-400 font-normal">Units</span>
            </p>
          </div>
          <span className="text-[9px] text-gray-455 mt-2 block">Net live physical stock remaining</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-amber-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Stock Value (Cost)</span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {formatCurrency(stockValuationCost)}
            </p>
          </div>
          <span className="text-[9px] text-gray-405 mt-2 block">Value based on Purchase Price</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-blue-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Stock Value (Sales)</span>
            <p className="text-2xl font-black text-blue-650 dark:text-blue-400 mt-1">
              {formatCurrency(stockValuationSale)}
            </p>
          </div>
          <span className="text-[9px] text-gray-405 mt-2 block">Expected selling value</span>
        </div>
      </div>

      {/* Product additions modal / side-drawer container */}
      {showAddForm && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-md">
          <h3 id="form-product-title" className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-50 pb-2">
            {editingProduct ? 'Configure Product Master Record' : 'Register New Inventory Product'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">PRODUCT NAME *</label>
                <input
                  id="form-p-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Copper Wire Coil"
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">CATEGORY</label>
                <input
                  id="form-p-cat"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Cables / Electronics"
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">SKU CODE *</label>
                <input
                  id="form-p-sku"
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g. WIRE-COP-01"
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">BARCODE CODE</label>
                <input
                  id="form-p-barcode"
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or enter code"
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">8-Digit HSN Code *</label>
                <input
                  id="form-p-hsn"
                  type="text"
                  required
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="e.g. 74081190"
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">UNIT</label>
                <select
                  id="sel-p-unit"
                  value={unit}
                  onChange={(e: any) => setUnit(e.target.value)}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="PCS">PCS (Pieces)</option>
                  <option value="KG">KG (Kilograms)</option>
                  <option value="LITER">LITER (Liters)</option>
                  <option value="BOX">BOX (Boxes)</option>
                  <option value="MTR">MTR (Meters)</option>
                  <option value="SET">SET (Sets)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">PURCHASE PRICE (Rs) *</label>
                <input
                  id="form-p-pprice"
                  type="number"
                  min="0"
                  required
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">SELLING PRICE (Rs) *</label>
                <input
                  id="form-p-sprice"
                  type="number"
                  min="0"
                  required
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">{countryConfig.taxName.toUpperCase()} COMPLIANCE RATE (%)</label>
                <select
                  id="sel-p-gst"
                  value={gstRate}
                  onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-205 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white font-mono"
                >
                  {countryConfig.taxRates.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}% {rate === 0 ? '(Exempt)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!editingProduct && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">OPENING STOCK QUANTITY</label>
                  <input
                    id="form-p-stock"
                    type="number"
                    min="0"
                    value={openingStock}
                    onChange={(e: any) => {
                      setOpeningStock(parseInt(e.target.value) || 0);
                      setCurrentStock(parseInt(e.target.value) || 0);
                    }}
                    className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              )}

              {editingProduct && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">ADJUST CURRENT STOCK</label>
                  <input
                    id="form-p-adj"
                    type="number"
                    value={currentStock}
                    onChange={(e: any) => setCurrentStock(parseInt(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white text-blue-600 font-extrabold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">LOW STOCK THRESHOLD</label>
                <input
                  id="form-p-thresh"
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e: any) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                id="form-p-close"
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2 rounded-xl text-xs bg-gray-100 hover:bg-gray-255 text-gray-700 font-semibold dark:bg-zinc-800 dark:text-zinc-200"
              >
                {t('cancel')}
              </button>
              <button
                id="form-p-submit"
                type="submit"
                className="px-4 py-2 rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {t('save')}
              </button>
            </div>
          </form>

        </div>
      )}

      {/* Main materials catalog table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-xs">
            <Boxes className="w-12 h-12 stroke-1 mb-2 text-gray-300" />
            No products match active filter. Register products or stock items soon.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left text-gray-550 dark:text-zinc-400 border-collapse border border-gray-200 dark:border-zinc-805">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 font-extrabold uppercase text-[9px] tracking-widest bg-gray-100/80 dark:bg-zinc-800/35 text-gray-500">
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800">Item Details</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800">HSN / SKU</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800">Unit Pricing ({countryConfig.currencySymbol})</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800">{countryConfig.taxName} Rate</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800 text-center">Opening Stock</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800 text-center bg-emerald-50/20 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-extrabold">Inward (Purchase)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800 text-center bg-rose-50/20 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-extrabold">Outward (Sales)</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800 text-center bg-amber-50/20 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400 font-extrabold">Balance Stock</th>
                  <th className="py-2.5 px-3 border-r border-gray-200 dark:border-zinc-800 text-center bg-indigo-50/20 dark:bg-zinc-800/20 text-indigo-800 dark:text-indigo-400 font-extrabold">Stock Value</th>
                  <th className="py-2.5 px-3 text-center">Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-zinc-800/50">
                {filteredProducts.map((p, idx) => {
                  const isLow = p.currentStock <= p.lowStockThreshold;
                  const stats = productStats[p.productId] || { purchased: 0, purchaseReturned: 0, sold: 0, salesReturned: 0 };
                  return (
                    <tr key={idx} className="hover:bg-gray-150/20 dark:hover:bg-zinc-850/10 transition-colors even:bg-gray-50/40 dark:even:bg-zinc-900/10">
                      
                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50">
                        <span className="font-extrabold text-gray-900 dark:text-white block text-xs">{p.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="bg-blue-50 dark:bg-blue-900/10 text-blue-600 px-1 py-0.5 rounded text-[9px] uppercase font-bold">
                            {p.category || 'General'}
                          </span>
                          {p.barcode && (
                            <span className="text-[9px] text-gray-400 bg-gray-150 dark:bg-zinc-800 px-1 rounded font-mono">
                              Barcode: {p.barcode}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50 font-mono text-[11px] text-gray-600 dark:text-zinc-350">
                        <span className="block"><span className="text-gray-400 font-sans">HSN:</span> {p.hsnCode}</span>
                        <span className="text-gray-400 block mt-0.5"><span className="font-sans">SKU:</span> {p.sku}</span>
                      </td>

                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50 font-mono text-[11px] text-gray-600 dark:text-zinc-350">
                        <span className="block"><span className="text-gray-400 font-sans">Buy:</span> {formatCurrency(p.purchasePrice)}</span>
                        <span className="font-bold text-gray-900 dark:text-zinc-100 block mt-0.5"><span className="text-gray-400 font-sans">Sell:</span> {formatCurrency(p.sellingPrice)}</span>
                      </td>

                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50 font-extrabold font-mono text-[11px] text-gray-800 dark:text-zinc-200 text-center">
                        {p.gstRate}% {countryConfig.taxName}
                      </td>

                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-center font-semibold text-gray-600 dark:text-zinc-400 font-mono text-[11px]">
                        {p.openingStock || 0} <span className="text-[10px] text-gray-400 font-sans">{p.unit}</span>
                      </td>

                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-center bg-emerald-50/10 dark:bg-emerald-950/5 font-mono text-[11px]">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">+{stats.purchased} <span className="text-[9px] font-sans text-gray-400 font-normal">{p.unit}</span></div>
                        {stats.purchaseReturned > 0 && (
                          <div className="text-[9px] text-rose-500 font-medium">-{stats.purchaseReturned} Return</div>
                        )}
                        <div className="text-[9px] text-gray-500 dark:text-zinc-400- mt-0.5 border-t border-gray-100 dark:border-zinc-800 pt-0.5 whitespace-nowrap font-sans font-medium">
                          Net: {stats.purchased - stats.purchaseReturned} {p.unit}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-center bg-rose-50/10 dark:bg-rose-950/5 font-mono text-[11px]">
                        <div className="font-bold text-rose-600 dark:text-rose-400 font-mono">-{stats.sold} <span className="text-[9px] font-sans text-gray-400 font-normal">{p.unit}</span></div>
                        {stats.salesReturned > 0 && (
                          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">+{stats.salesReturned} Return</div>
                        )}
                        <div className="text-[9px] text-gray-500 dark:text-zinc-400 mt-0.5 border-t border-gray-100 dark:border-zinc-800 pt-0.5 whitespace-nowrap font-sans font-medium">
                          Net: {stats.sold - stats.salesReturned} {p.unit}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-center bg-amber-50/5 dark:bg-amber-950/5">
                        <span className={`font-black text-xs block ${isLow ? 'text-rose-500' : 'text-gray-900 dark:text-white'}`}>
                          {p.currentStock} {p.unit}
                        </span>
                        {isLow && (
                          <div className="flex items-center justify-center gap-1 text-[9px] text-rose-500 mt-0.5 font-bold">
                            <AlertCircle className="w-3 h-3 text-rose-500" />
                            <span>Low stock</span>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 border-r border-gray-150 dark:border-zinc-800/50 text-center bg-indigo-50/5 dark:bg-zinc-800/5 font-mono text-[11px]">
                        <div className="font-bold text-indigo-650 dark:text-indigo-400" title="Cost of Stock (Qty * Buy Price)">
                          {formatCurrency(p.currentStock * p.purchasePrice)}
                        </div>
                        <div className="text-[9px] text-gray-400 mt-0.5" title="Expected Selling Value (Qty * Sell Price)">
                          Sale: {formatCurrency(p.currentStock * p.sellingPrice)}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button
                            id={`btn-edit-product-${idx}`}
                            onClick={() => handleEdit(p)}
                            className="p-1 px-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 rounded-md border border-gray-200/50 dark:border-zinc-700 hover:cursor-pointer transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          
                          <button
                            id={`btn-delete-product-${idx}`}
                            onClick={() => handleDelete(p.productId, p.name)}
                            className="p-1 px-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-md border border-red-100/40 hover:cursor-pointer transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
