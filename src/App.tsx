import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Search, 
  Layout, 
  Folder, 
  Package,
  Pill,
  Utensils,
  Apple,
  Usb,
  X,
  Cloud,
  Loader2,
  AlertCircle,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from './services/db';
import type { Item, Category, Cabinet } from './services/db';
import { identifyImage, jumpToGoogleLens } from './services/ai';

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
  
  // 临时存储识别时的归属（用于从主页直接拍照的情况）
  const [tempCabinetId, setTempCabinetId] = useState('');
  
  // AI State
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifiedName, setIdentifiedName] = useState('');
  const [identifiedCategory, setIdentifiedCategory] = useState('');
  const [currentBase64, setCurrentBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
  };

  const addItem = (name: string, categoryName: string, quantity: number) => {
    const cabinetId = selectedCabinet?.id || tempCabinetId;
    
    if (!cabinetId) {
      alert('请先选择收纳位置（柜子）');
      return;
    }

    if (!categoryName.trim()) {
      alert('物品分类不能为空');
      return;
    }

    // 查找或创建分类
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
    const itemsCount = data.items.filter((i: Item) => i.cabinetId === id).length;
    if (confirm(`确定要删除这个柜子吗？${itemsCount > 0 ? `里面还有 ${itemsCount} 件物品也会被删除！` : ''}`)) {
      setData({
        ...data,
        cabinets: data.cabinets.filter((c: Cabinet) => c.id !== id),
        items: data.items.filter((i: Item) => i.cabinetId !== id)
      });
    }
  };

  const deleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemsCount = data.items.filter((i: Item) => i.categoryId === id).length;
    if (confirm(`确定要删除这个分类吗？${itemsCount > 0 ? `包含的 ${itemsCount} 件物品也会被删除！` : ''}`)) {
      setData({
        ...data,
        categories: data.categories.filter((c: Category) => c.id !== id),
        items: data.items.filter((i: Item) => i.categoryId !== id)
      });
    }
  };

  const updateItemQuantity = (id: string, delta: number) => {
    const updatedItems = data.items.map((item: Item) => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
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

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIdentifying(true);
    setError(null);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setCurrentBase64(base64);
        try {
          const result = await identifyImage(base64);
          setIdentifiedName(result.name);
          setIdentifiedCategory(result.category);
        } catch (err: any) {
          setError(err.message || "识别失败，请检查 API Key 配置");
        } finally {
          setIsIdentifying(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("读取图片失败");
      setIsIdentifying(false);
    }
  };

  const openCamera = () => {
    fileInputRef.current?.click();
  };

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
              <span>{syncStatus === 'done' ? '已同步至云端' : '正在同步...'}</span>
            </div>
          </div>
          {view !== 'cabinets' ? (
            <button onClick={handleBack} style={{ background: '#F1F5F9', border: 'none', padding: '8px', borderRadius: '50%' }}>
              <ChevronLeft size={24} />
            </button>
          ) : (
            <div style={{ padding: '8px', background: 'var(--lemon)', borderRadius: '50%', color: 'white' }}>
              <Plus size={24} />
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="搜索物品..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px 12px 12px 40px', 
              borderRadius: '12px', 
              border: '1px solid #E2E8F0',
              outline: 'none',
              fontSize: '14px'
            }}
          />
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait">
          {searchQuery ? (
            <motion.div 
              key="search-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: '0 16px' }}
            >
              <h2 style={{ marginBottom: 16, fontSize: '18px' }}>搜索结果 ({filteredItems.length})</h2>
              {filteredItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <Search size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p>没有找到相关物品</p>
                </div>
              ) : (
                filteredItems.map((item: Item) => (
                  <motion.div 
                    layout
                    key={item.id} 
                    className="card item-card" 
                    style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      marginBottom: 12,
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div className="item-initial">
                        {item.name[0]}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '16px' }}>{item.name}</h4>
                        <p style={{ fontSize: '12px' }}>
                          {data.cabinets.find((c: Cabinet) => c.id === item.cabinetId)?.name} · {new Date(item.addedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="quantity-controls">
                      <button onClick={() => updateItemQuantity(item.id, -1)} disabled={item.quantity <= 0}>
                        <Minus size={14} />
                      </button>
                      <span className="quantity-badge">{item.quantity}</span>
                      <button onClick={() => updateItemQuantity(item.id, 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            <>
              {view === 'cabinets' && (
                <motion.div 
                  key="cabinets"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="grid"
                >
                  {data.cabinets.map((cab: Cabinet) => {
                    const itemsCount = data.items.filter((i: Item) => i.cabinetId === cab.id).length;
                    return (
                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={cab.id} 
                        className="card" 
                        onClick={() => handleCabinetClick(cab)}
                      >
                        <button 
                          className="card-delete-btn"
                          onClick={(e) => deleteCabinet(cab.id, e)}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="card-icon" style={{ background: cab.color }}>
                          <Layout size={24} />
                        </div>
                        <h3>{cab.name}</h3>
                        <p>{itemsCount} 件物品</p>
                      </motion.div>
                    );
                  })}
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="card" 
                    style={{ border: '2px dashed #E2E8F0', background: 'transparent' }}
                    onClick={() => setIsAddCabinetModalOpen(true)}
                  >
                    <Plus size={24} color="#CBD5E1" />
                    <p>添加新柜子</p>
                  </motion.div>
                </motion.div>
              )}

              {view === 'categories' && (
                <motion.div 
                  key="categories"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid"
                >
                  {data.categories.map((cat: Category) => {
                    const Icon = IconMap[cat.icon] || Folder;
                    const itemsCount = data.items.filter((i: Item) => i.cabinetId === selectedCabinet?.id && i.categoryId === cat.id).length;
                    return (
                      <motion.div 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={cat.id} 
                        className="card" 
                        onClick={() => handleCategoryClick(cat)}
                      >
                        <button 
                          className="card-delete-btn"
                          onClick={(e) => deleteCategory(cat.id, e)}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="card-icon" style={{ background: cat.color }}>
                          <Icon size={24} />
                        </div>
                        <h3>{cat.name}</h3>
                        <p>{itemsCount} 件</p>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {view === 'items' && (
                <motion.div 
                  key="items"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  style={{ padding: '0 16px' }}
                >
                  <h2 style={{ marginBottom: 16, fontSize: '18px' }}>
                    {selectedCabinet?.name} / {selectedCategory?.name}
                  </h2>
                  {filteredItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                      <Package size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                      <p>这里空空如也，拍张照添加吧！</p>
                    </div>
                  ) : (
                    filteredItems.map((item: Item) => (
                      <motion.div 
                        layout
                        key={item.id} 
                        className="card item-card" 
                        style={{ 
                          flexDirection: 'row', 
                          justifyContent: 'space-between', 
                          marginBottom: 12,
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div className="item-initial">
                            {item.name[0]}
                          </div>
                          <div>
                            <h4 style={{ fontSize: '16px' }}>{item.name}</h4>
                            <p style={{ fontSize: '12px' }}>
                              {new Date(item.addedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="quantity-controls">
                          <button onClick={() => updateItemQuantity(item.id, -1)} disabled={item.quantity <= 0}>
                            <Minus size={14} />
                          </button>
                          <span className="quantity-badge">{item.quantity}</span>
                          <button onClick={() => updateItemQuantity(item.id, 1)}>
                            <Plus size={14} />
                          </button>
                          <div className="divider"></div>
                          <button 
                            onClick={() => deleteItem(item.id)}
                            className="delete-btn"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </main>

      <button className="fab" onClick={() => setIsAiModalOpen(true)}>
        <Camera size={32} />
      </button>

      {/* AI Camera Modal */}
      {isAiModalOpen && (
        <div className="modal-overlay" onClick={closeAiModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '20px' }}>AI 物品识别</h2>
              <button onClick={closeAiModal} style={{ background: 'none', border: 'none' }}><X /></button>
            </div>
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              onChange={handleCapture}
              style={{ display: 'none' }}
            />

            {error && (
              <div style={{ 
                background: '#FEF2F2', border: '1px solid #FCA5A5', 
                padding: '12px', borderRadius: '12px', marginBottom: 16,
                display: 'flex', gap: 8, color: '#991B1B', fontSize: '14px'
              }}>
                <AlertCircle size={18} />
                <p>{error}</p>
              </div>
            )}

            {!identifiedName ? (
              <>
                <div className="camera-preview" onClick={openCamera} style={{ cursor: 'pointer' }}>
                  {isIdentifying ? (
                    <div style={{ textAlign: 'center' }}>
                      <Loader2 size={48} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                      <p>正在分析中...</p>
                    </div>
                  ) : (
                    <>
                      <div className="camera-shutter"></div>
                      <p>点击这里拍照</p>
                    </>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
                  AI 将自动识别物品名称并协助您归档
                </p>
              </>
            {/* 结果显示区域 */}
            {identifiedName && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: 4, textAlign: 'left' }}>物品名称</label>
                  <input 
                    type="text" 
                    value={identifiedName} 
                    onChange={(e) => setIdentifiedName(e.target.value)}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '12px', 
                      border: '2px solid var(--mint)', textAlign: 'left',
                      fontSize: '16px', fontWeight: 'bold'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: 4, textAlign: 'left' }}>自动分类</label>
                  <input 
                    type="text" 
                    value={identifiedCategory} 
                    onChange={(e) => setIdentifiedCategory(e.target.value)}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '12px', 
                      border: '2px solid var(--sky)', textAlign: 'left',
                      fontSize: '16px', fontWeight: 'bold'
                    }}
                  />
                </div>
              </div>
            )}

            {/* 如果在主页点击，需要选择柜子 */}
            {identifiedName && !selectedCabinet && (
              <div style={{ marginBottom: 24, textAlign: 'left' }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: 4 }}>存入柜子</label>
                  <select 
                    value={tempCabinetId} 
                    onChange={(e) => setTempCabinetId(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  >
                    <option value="">请选择柜子...</option>
                    {data.cabinets.map((c: Cabinet) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* 底部操作区 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {identifiedName ? (
                <>
                  <button className="btn btn-primary" onClick={() => addItem(identifiedName, identifiedCategory, 1)}>确认并添加</button>
                  <button className="btn btn-secondary" onClick={() => { setIdentifiedName(''); setIdentifiedCategory(''); }}>重新拍照</button>
                </>
              ) : !isIdentifying && (
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={openCamera}>点击拍照/选择图片</button>
              )}
            </div>

            {/* Google Lens 强力辅助 (常显，只要有图就能用) */}
            {currentBase64 && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, marginTop: 8 }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>
                  {isIdentifying ? '识别慢？试试直接去谷歌：' : '或者使用谷歌深度识别：'}
                </p>
                <button 
                  className="btn" 
                  style={{ background: '#4285F4', color: 'white', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => jumpToGoogleLens(currentBase64)}
                >
                  <Search size={18} /> 使用 Google Lens 识别
                </button>
              </div>
            )}
          </div>
        </div>
      )}
          </div>
        </div>
      )}

      {/* Add Cabinet Modal */}
      {isAddCabinetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddCabinetModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '20px' }}>新增收纳柜</h2>
              <button onClick={() => setIsAddCabinetModalOpen(false)} style={{ background: 'none', border: 'none' }}><X /></button>
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 'bold' }}>柜子名称</label>
              <input 
                type="text" 
                placeholder="例如：主卧大衣柜" 
                value={newCabinetName}
                onChange={(e) => setNewCabinetName(e.target.value)}
                style={{ 
                  width: '100%', padding: '12px', borderRadius: '12px', 
                  border: '1px solid #E2E8F0', fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', marginBottom: 12, fontSize: '14px', fontWeight: 'bold' }}>选择主题色</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {colors.map((color: { value: string; name: string; hex: string }) => (
                  <div 
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    style={{ 
                      width: 40, height: 40, borderRadius: '50%', 
                      background: `var(${color.value})`, cursor: 'pointer',
                      border: selectedColor === color.value ? '3px solid white' : 'none',
                      boxShadow: selectedColor === color.value ? '0 0 0 2px var(--text-primary)' : 'none'
                    }}
                  />
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

