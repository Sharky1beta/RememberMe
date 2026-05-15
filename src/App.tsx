import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Search, 
  Layout, 
  Folder, 
  Pill,
  Utensils,
  Apple,
  Usb,
  X,
  Cloud,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from './services/db';
import type { Item, Category, Cabinet } from './services/db';
import { jumpToGoogleLens } from './services/ai';

const IconMap: Record<string, React.ElementType> = {
  Pill,
  Utensils,
  Apple,
  Usb,
};

type View = 'cabinets' | 'categories' | 'items';

const App: React.FC = () => {
  const [data, setData] = useState(db.loadData());
  const [view, setView] = useState<View>('cabinets');
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAddCabinetModalOpen, setIsAddCabinetModalOpen] = useState(false);
  const [newCabinetName, setNewCabinetName] = useState('');
  const [selectedColor, setSelectedColor] = useState('--coral');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('done');
  
  const [tempCabinetId, setTempCabinetId] = useState('');
  const [identifiedName, setIdentifiedName] = useState('');
  const [identifiedCategory, setIdentifiedCategory] = useState('');
  const [currentBase64, setCurrentBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colors = [
    { name: '珊瑚橙', value: '--coral', hex: '#FF7F50' },
    { name: '薄荷绿', value: '--mint', hex: '#48D1CC' },
    { name: '天空蓝', value: '--sky', hex: '#87CEEB' },
    { name: '柠檬黄', value: '--lemon', hex: '#FFD700' },
    { name: '薰衣草', value: '--purple', hex: '#9370DB' },
  ];

  useEffect(() => {
    db.saveData(data);
    setSyncStatus('syncing');
    setTimeout(() => setSyncStatus('done'), 1000);
  }, [data]);

  const handleCabinetClick = (cab: Cabinet) => {
    setSelectedCabinet(cab);
    setView('categories');
  };

  const handleCategoryClick = (cat: Category) => {
    setSelectedCategory(cat);
    setView('items');
  };

  const handleBack = () => {
    if (view === 'items') setView('categories');
    else if (view === 'categories') setView('cabinets');
  };

  const closeAiModal = () => {
    setIsAiModalOpen(false);
    setIdentifiedName('');
    setIdentifiedCategory('');
    setCurrentBase64(null);
  };

  const addItem = (name: string, categoryName: string, quantity: number) => {
    const cabinetId = selectedCabinet?.id || tempCabinetId;
    if (!cabinetId) { alert('请选择收纳位置'); return; }
    if (!name.trim() || !categoryName.trim()) { alert('名称和分类不能为空'); return; }

    let category = data.categories.find((c: Category) => c.name === categoryName.trim());
    let newData = { ...data };

    if (!category) {
      category = {
        id: Date.now().toString() + '-cat',
        name: categoryName.trim(),
        icon: 'Package',
        color: colors[Math.floor(Math.random() * colors.length)].hex
      };
      newData.categories = [...data.categories, category];
    }

    const newItem: Item = {
      id: Date.now().toString(),
      name,
      quantity,
      addedAt: Date.now(),
      cabinetId,
      categoryId: category.id,
    };
    
    newData.items = [...data.items, newItem];
    setData(newData);
    closeAiModal();
  };

  const deleteCabinet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个柜子吗？')) {
      setData({
        ...data,
        cabinets: data.cabinets.filter((c: Cabinet) => c.id !== id),
        items: data.items.filter((i: Item) => i.cabinetId !== id)
      });
    }
  };

  const deleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个分类吗？')) {
      setData({
        ...data,
        categories: data.categories.filter((c: Category) => c.id !== id),
        items: data.items.filter((i: Item) => i.categoryId !== id)
      });
    }
  };

  const updateItemQuantity = (id: string, delta: number) => {
    const updatedItems = data.items.map((item: Item) => {
      if (item.id === id) { return { ...item, quantity: Math.max(0, item.quantity + delta) }; }
      return item;
    });
    setData({ ...data, items: updatedItems });
  };

  const deleteItem = (id: string) => {
    if (confirm('确定要删除这件物品吗？')) {
      setData({ ...data, items: data.items.filter((i: Item) => i.id !== id) });
    }
  };

  const handleAddCabinet = () => {
    if (!newCabinetName.trim()) return;
    const colorValue = colors.find(c => c.value === selectedColor)?.hex || '#FF7F50';
    const newCab: Cabinet = {
      id: Date.now().toString(),
      name: newCabinetName,
      color: colorValue,
      type: 'custom'
    };
    setData({ ...data, cabinets: [...data.cabinets, newCab] });
    setIsAddCabinetModalOpen(false);
    setNewCabinetName('');
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setCurrentBase64(reader.result as string); };
    reader.readAsDataURL(file);
  };

  const openCamera = () => { fileInputRef.current?.click(); };

  const filteredItems = data.items.filter((item: Item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (searchQuery && view === 'cabinets') return matchesSearch;
    const matchesCabinet = selectedCabinet ? item.cabinetId === selectedCabinet.id : true;
    const matchesCategory = selectedCategory ? item.categoryId === selectedCategory.id : true;
    return matchesSearch && matchesCabinet && matchesCategory;
  });

  return (
    <div className="app-container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>RememberMe</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '12px' }}>
              <Cloud size={14} color={syncStatus === 'done' ? 'var(--mint)' : 'var(--coral)'} />
              <span>{syncStatus === 'done' ? '已同步' : '同步中'}</span>
            </div>
          </div>
          {view !== 'cabinets' ? (
            <button onClick={handleBack} className="btn-icon"><ChevronLeft size={24} /></button>
          ) : (
            <div className="btn-icon-static"><Plus size={24} /></div>
          )}
        </div>
        <div style={{ marginTop: 20, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
          <input type="text" placeholder="搜索物品..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: '1px solid #E2E8F0' }} />
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait">
          {searchQuery ? (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '0 16px' }}>
              {filteredItems.map((item: Item) => (
                <div key={item.id} className="card item-card" style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div><h4>{item.name}</h4><p style={{ fontSize: '12px' }}>{data.cabinets.find((c: Cabinet) => c.id === item.cabinetId)?.name}</p></div>
                  <div className="quantity-controls">
                    <button onClick={() => updateItemQuantity(item.id, -1)}><Minus size={14} /></button>
                    <span className="quantity-badge">{item.quantity}</span>
                    <button onClick={() => updateItemQuantity(item.id, 1)}><Plus size={14} /></button>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <>
              {view === 'cabinets' && (
                <div className="grid">
                  {data.cabinets.map((cab: Cabinet) => (
                    <div key={cab.id} className="card" onClick={() => handleCabinetClick(cab)}>
                      <button className="card-delete-btn" onClick={(e) => deleteCabinet(cab.id, e)}><Trash2 size={16} /></button>
                      <div className="card-icon" style={{ background: cab.color }}><Layout size={24} /></div>
                      <h3>{cab.name}</h3>
                      <p>{data.items.filter((i: Item) => i.cabinetId === cab.id).length} 件</p>
                    </div>
                  ))}
                  <div className="card" style={{ border: '2px dashed #E2E8F0', background: 'transparent' }} onClick={() => setIsAddCabinetModalOpen(true)}>
                    <Plus size={24} color="#CBD5E1" /><p>添加新柜子</p>
                  </div>
                </div>
              )}
              {view === 'categories' && (
                <div className="grid">
                  {data.categories.map((cat: Category) => {
                    const Icon = IconMap[cat.icon] || Folder;
                    return (
                      <div key={cat.id} className="card" onClick={() => handleCategoryClick(cat)}>
                        <button className="card-delete-btn" onClick={(e) => deleteCategory(cat.id, e)}><Trash2 size={16} /></button>
                        <div className="card-icon" style={{ background: cat.color }}><Icon size={24} /></div>
                        <h3>{cat.name}</h3>
                      </div>
                    );
                  })}
                </div>
              )}
              {view === 'items' && (
                <div style={{ padding: '0 16px' }}>
                  <h2 style={{ marginBottom: 16, fontSize: '18px' }}>{selectedCabinet?.name} / {selectedCategory?.name}</h2>
                  {filteredItems.map((item: Item) => (
                    <div key={item.id} className="card item-card" style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h4>{item.name}</h4>
                      <div className="quantity-controls">
                        <button onClick={() => updateItemQuantity(item.id, -1)}><Minus size={14} /></button>
                        <span className="quantity-badge">{item.quantity}</span>
                        <button onClick={() => updateItemQuantity(item.id, 1)}><Plus size={14} /></button>
                        <button onClick={() => deleteItem(item.id)} className="delete-btn"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </AnimatePresence>
      </main>

      <button className="fab" onClick={() => setIsAiModalOpen(true)}><Camera size={32} /></button>

      {isAiModalOpen && (
        <div className="modal-overlay" onClick={closeAiModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '20px' }}>添加新物品</h2>
              <button onClick={closeAiModal} style={{ background: 'none', border: 'none' }}><X /></button>
            </div>
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} style={{ display: 'none' }} />
            {!currentBase64 ? (
              <div className="camera-preview" onClick={openCamera}><div className="camera-shutter"></div><p>点击拍照/上传</p></div>
            ) : (
              <div style={{ marginBottom: 20, borderRadius: '12px', overflow: 'hidden', height: '160px' }}>
                <img src={currentBase64} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>名称</label>
                <input type="text" placeholder="输入名称..." value={identifiedName} onChange={(e) => setIdentifiedName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>分类</label>
                <input type="text" placeholder="如：药品" value={identifiedCategory} onChange={(e) => setIdentifiedCategory(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }} />
              </div>
            </div>
            {!selectedCabinet && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>存入柜子</label>
                <select value={tempCabinetId} onChange={(e) => setTempCabinetId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <option value="">请选择柜子...</option>
                  {data.cabinets.map((c: Cabinet) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-primary" onClick={() => addItem(identifiedName, identifiedCategory, 1)} disabled={!identifiedName || (!selectedCabinet && !tempCabinetId)}>确认添加</button>
              <button className="btn btn-secondary" onClick={() => { setIdentifiedName(''); setIdentifiedCategory(''); setCurrentBase64(null); }}>重新拍照</button>
            </div>
            {currentBase64 && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
                <button className="btn" style={{ background: '#4285F4', color: 'white', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => jumpToGoogleLens(currentBase64)}>
                  <Search size={18} /> 去 Google Lens 识别
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddCabinetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddCabinetModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '20px' }}>新增收纳柜</h2>
              <button onClick={() => setIsAddCabinetModalOpen(false)} style={{ background: 'none', border: 'none' }}><X /></button>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 'bold' }}>名称</label>
              <input type="text" placeholder="例如：大衣柜" value={newCabinetName} onChange={(e) => setNewCabinetName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }} />
            </div>
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {colors.map((color) => (
                  <div key={color.value} onClick={() => setSelectedColor(color.value)} style={{ width: 40, height: 40, borderRadius: '50%', background: `var(${color.value})`, cursor: 'pointer', border: selectedColor === color.value ? '3px solid white' : 'none', boxShadow: selectedColor === color.value ? '0 0 0 2px var(--text-primary)' : 'none' }} />
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleAddCabinet}>确认创建</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
