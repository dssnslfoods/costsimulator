import { useState, useRef, useMemo } from 'react';
import { useAppState } from '@/store/AppContext';
import { Promotion, PromotionItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Plus, Pencil, Trash2, Search, Save, X,
    FileUp, ChevronRight, LayoutGrid, List,
    Calendar, Package, ShoppingCart, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { parsePromotionExcel } from '@/lib/excelImport';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import * as XLSX from 'xlsx';

export default function PromotionManager() {
    const { state, dispatch } = useAppState();
    const { products, promotions } = state;

    const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
    const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);

    const [editing, setEditing] = useState<Promotion | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedItems, setSelectedItems] = useState<PromotionItem[]>([]);
    const [search, setSearch] = useState('');
    const [filterGroup, setFilterGroup] = useState<string>('all');
    const [filterCountry, setFilterCountry] = useState<string>('all');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uniqueGroups = useMemo(() =>
        Array.from(new Set(products.map(p => p.item_group).filter(Boolean) as string[])).sort(),
        [products]
    );
    const uniqueCountries = useMemo(() =>
        Array.from(new Set(products.map(p => p.item_country).filter(Boolean) as string[])).sort(),
        [products]
    );

    const filteredProducts = products.filter(p => {
        const matchesSearch =
            p.item_id.toLowerCase().includes(search.toLowerCase()) ||
            p.item_name.toLowerCase().includes(search.toLowerCase()) ||
            (p.item_group || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.item_country || '').toLowerCase().includes(search.toLowerCase());
        const matchesGroup = filterGroup === 'all' || p.item_group === filterGroup;
        const matchesCountry = filterCountry === 'all' || p.item_country === filterCountry;
        return matchesSearch && matchesGroup && matchesCountry;
    });

    const startCreate = () => {
        setIsCreating(true);
        setEditing(null);
        setName('');
        setDescription('');
        setSelectedItems([]);
        setSearch('');
    };

    const startEdit = (promo: Promotion) => {
        setEditing(promo);
        setIsCreating(false);
        setName(promo.name);
        setDescription(promo.description);
        setSelectedItems([...promo.items]);
        setSearch('');
    };

    const cancel = () => {
        setIsCreating(false);
        setEditing(null);
        setName('');
        setDescription('');
        setSelectedItems([]);
        setSearch('');
        setFilterGroup('all');
        setFilterCountry('all');
    };

    const handleSave = () => {
        if (!name.trim()) { toast.error('กรุณาใส่ชื่อโปรโมชั่น'); return; }
        if (selectedItems.length === 0) { toast.error('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'); return; }

        const finalItems = selectedItems.map(item => {
            const prod = products.find(p => p.item_id === item.item_id);
            return {
                ...item,
                item_name: item.item_name || prod?.item_name || 'Unknown'
            };
        });

        if (editing) {
            const updated: Promotion = {
                ...editing,
                name: name.trim(),
                description: description.trim(),
                items: finalItems,
            };
            dispatch({ type: 'UPDATE_PROMOTION', payload: updated });
            toast.success(`อัปเดตโปรโมชั่น "${updated.name}" แล้ว`);
        } else {
            const promo: Promotion = {
                id: crypto.randomUUID(),
                name: name.trim(),
                description: description.trim(),
                items: finalItems,
                created_at: new Date().toISOString(),
            };
            dispatch({ type: 'ADD_PROMOTION', payload: promo });
            toast.success(`สร้างโปรโมชั่น "${promo.name}" แล้ว`);
        }
        cancel();
    };

    const handleDelete = (promo: Promotion, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`คุณต้องการลบโปรโมชั่น "${promo.name}" ใช่หรือไม่?`)) {
            dispatch({ type: 'DELETE_PROMOTION', payload: promo.id });
            if (selectedPromotion?.id === promo.id) {
                setViewMode('grid');
                setSelectedPromotion(null);
            }
            toast.success(`ลบโปรโมชั่น "${promo.name}" แล้ว`);
        }
    };

    const toggleProduct = (id: string) => {
        const exists = selectedItems.find(i => i.item_id === id);
        if (exists) {
            setSelectedItems(prev => prev.filter(i => i.item_id !== id));
        } else {
            const p = products.find(prod => prod.item_id === id);
            setSelectedItems(prev => [...prev, { item_id: id, item_name: p?.item_name || '', volume: p?.sale_volume || 0 }]);
        }
    };

    const updateItemVolume = (id: string, volume: number) => {
        setSelectedItems(prev => prev.map(i => i.item_id === id ? { ...i, volume } : i));
    };

    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const items = await parsePromotionExcel(file);
            // Merge unique items or replace? Let's merge and update volumes
            setSelectedItems(prev => {
                const next = [...prev];
                items.forEach(newItem => {
                    const idx = next.findIndex(i => i.item_id === newItem.item_id);
                    if (idx >= 0) {
                        next[idx] = { ...next[idx], volume: newItem.volume, item_name: newItem.item_name || next[idx].item_name };
                    } else {
                        next.push(newItem);
                    }
                });
                return next;
            });
            toast.success(`นำเข้าสินค้า ${items.length} รายการสำเร็จ`);
        } catch (err) {
            toast.error('ล้มเหลวในการอ่านไฟล์ Excel');
            console.error(err);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportSelected = (promo: Promotion) => {
        if (!promo.items.length) {
            toast.error('ไม่มีสินค้าในโปรโมชั่นนี้');
            return;
        }
        const data = promo.items.map(item => ({
            'Item ID': item.item_id,
            'Item Name': item.item_name,
            'Sale Volume': item.volume
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Items');
        XLSX.writeFile(wb, `promotion_${promo.name.replace(/\s+/g, '_')}.xlsx`);
        toast.success('ส่งออกข้อมูลสำเร็จ');
    };

    const handleExportAll = () => {
        if (promotions.length === 0) {
            toast.error('ไม่มีข้อมูลโปรโมชั่นให้ส่งออก');
            return;
        }
        const data = promotions.map(p => ({
            'ID': p.id,
            'Name': p.name,
            'Description': p.description,
            'Items Count': p.items.length,
            'Total Volume': p.items.reduce((sum, item) => sum + item.volume, 0),
            'Created At': new Date(p.created_at).toLocaleString()
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Promotions');
        XLSX.writeFile(wb, 'all_promotions_summary.xlsx');
        toast.success('ส่งออกข้อมูลสรุปทุกโปรโมชั่นสำเร็จ');
    };

    const isFormOpen = isCreating || editing !== null;

    if (products.length === 0) {
        return (
            <div className="metric-card text-center py-16 animate-fade-in">
                <h3 className="text-lg font-semibold mb-2">ไม่มีสินค้า</h3>
                <p className="text-muted-foreground text-sm">นำเข้าสินค้าจากหน้า Product Master ก่อน</p>
            </div>
        );
    }

    // Promotion Details View (Table)
    if (viewMode === 'detail' && selectedPromotion) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" className="gap-2" onClick={() => setViewMode('grid')}>
                        <X size={16} /> กลับไปยังรายการ
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleExportSelected(selectedPromotion)}>
                            <Download size={14} /> ส่งออก Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { startEdit(selectedPromotion); setViewMode('grid'); }}>
                            <Pencil size={14} /> แก้ไขโปรโมชั่น
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => handleDelete(selectedPromotion, e)}>
                            <Trash2 size={14} /> ลบ
                        </Button>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Package size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{selectedPromotion.name}</h2>
                            <p className="text-muted-foreground">{selectedPromotion.description || 'ไม่มีคำอธิบาย'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase font-semibold">สินค้าทั้งหมด</p>
                            <p className="text-xl font-bold">{selectedPromotion.items.length} รายการ</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase font-semibold">ยอดขายรวม</p>
                            <p className="text-xl font-bold">
                                {formatNumber(selectedPromotion.items.reduce((s, i) => s + i.volume, 0))} ชิ้น
                            </p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase font-semibold">วันที่สร้าง</p>
                            <p className="text-xl font-bold">{new Date(selectedPromotion.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">รหัสสินค้า</th>
                                    <th className="px-4 py-3 text-left font-medium">ชื่อสินค้า</th>
                                    <th className="px-4 py-3 text-right font-medium">ปริมาณขาย</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {selectedPromotion.items.map(item => (
                                    <tr key={item.item_id} className="hover:bg-muted/20">
                                        <td className="px-4 py-3 font-mono text-xs">{item.item_id}</td>
                                        <td className="px-4 py-3">{item.item_name}</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatNumber(item.volume)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">จัดการโปรโมชั่น (Promotion Management)</h2>
                    <p className="text-muted-foreground text-sm mt-1">จัดกลุ่มสินค้าและกำหนดเป้าหมายปริมาณขายสำหรับแต่ละแคมเปญ</p>
                </div>
                {!isFormOpen && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportAll}>
                            <Download size={14} /> ส่งออกทั้งหมด
                        </Button>
                        <Button size="sm" onClick={startCreate}>
                            <Plus size={14} />
                            สร้างโปรโมชั่นใหม่
                        </Button>
                    </div>
                )}
            </div>

            {/* Form Section */}
            {isFormOpen && (
                <div className="metric-card space-y-6 animate-slide-up">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                            {editing ? <Pencil size={18} /> : <Plus size={18} />}
                            {editing ? `แก้ไขโปรโมชั่น: ${editing.name}` : 'สร้างแคมเปญโปรโมชั่นใหม่'}
                        </h3>
                        <Button variant="ghost" size="icon" onClick={cancel}><X size={18} /></Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold mb-1 block">ชื่อโปรโมชั่น/แคมเปญ *</label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น MID YEAR SALE 2024" />
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1 block">รายละเอียด</label>
                                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="ระบุเงื่อนไขหรือกลุ่มเป้าหมาย" />
                            </div>

                            <div className="pt-4 border-t">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <label className="text-sm font-semibold">เลือกสินค้า ({selectedItems.length})</label>
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {uniqueGroups.length > 0 && (
                                            <Select value={filterGroup} onValueChange={setFilterGroup}>
                                                <SelectTrigger className="h-8 w-36 text-xs">
                                                    <SelectValue placeholder="สถานที่จำหน่าย" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">ทุกสถานที่</SelectItem>
                                                    {uniqueGroups.map(g => (
                                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {uniqueCountries.length > 0 && (
                                            <Select value={filterCountry} onValueChange={setFilterCountry}>
                                                <SelectTrigger className="h-8 w-36 text-xs">
                                                    <SelectValue placeholder="ประเทศที่จำหน่าย" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">ทุกประเทศ</SelectItem>
                                                    {uniqueCountries.map(c => (
                                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                            <Input placeholder="ค้นหาสินค้า..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-36 text-xs" />
                                        </div>
                                    </div>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto border rounded-xl bg-muted/5 divide-y">
                                    {filteredProducts.map(p => {
                                        const item = selectedItems.find(i => i.item_id === p.item_id);
                                        return (
                                            <div key={p.item_id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                                                <Checkbox checked={!!item} onCheckedChange={() => toggleProduct(p.item_id)} />
                                                <div className="flex-1 min-w-0" onClick={() => toggleProduct(p.item_id)}>
                                                    <div className="text-sm font-medium truncate">{p.item_name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono">{p.item_id}</div>
                                                </div>
                                                {item && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-muted-foreground">Vol:</span>
                                                        <Input
                                                            type="number"
                                                            value={item.volume}
                                                            onChange={e => updateItemVolume(p.item_id, Number(e.target.value))}
                                                            className="h-7 w-20 text-xs text-right font-mono"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 border-l pl-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-primary uppercase flex items-center gap-2">
                                    <ShoppingCart size={14} /> สรุปสินค้าในโปรโมชั่น
                                </h4>
                                <div className="flex gap-2">
                                    <input type="file" ref={fileInputRef} onChange={handleExcelImport} accept=".xlsx,.xls" className="hidden" />
                                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
                                        const template = [{ item_id: 'ITEM001', volume: 100 }];
                                        const ws = XLSX.utils.json_to_sheet(template);
                                        const wb = XLSX.utils.book_new();
                                        XLSX.utils.book_append_sheet(wb, ws, 'Template');
                                        XLSX.writeFile(wb, 'promotion_template.xlsx');
                                        toast.success('ดาวน์โหลด Template แล้ว');
                                    }}>
                                        <Download size={14} /> Template
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()}>
                                        <FileUp size={14} /> Import Excel
                                    </Button>
                                </div>
                            </div>

                            {selectedItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-12 border-2 border-dashed rounded-xl bg-muted/10 opacity-60">
                                    <Package size={40} className="text-muted-foreground mb-2" />
                                    <p className="text-sm">ยังไม่ได้เลือกสินค้าหรือนำเข้าไฟล์</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2">
                                    {selectedItems.map(item => (
                                        <div key={item.item_id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-secondary/30">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold truncate">{item.item_name}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{item.item_id}</p>
                                            </div>
                                            <div className="text-right ml-4">
                                                <p className="text-xs text-muted-foreground">เป้าหมายยอดขาย</p>
                                                <p className="font-mono text-sm font-bold text-primary">{formatNumber(item.volume)}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 text-muted-foreground hover:text-destructive" onClick={() => toggleProduct(item.item_id)}>
                                                <Trash2 size={12} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t">
                        <Button variant="outline" onClick={cancel} className="gap-2">
                            <X size={16} /> ยกเลิก
                        </Button>
                        <Button onClick={handleSave} className="gap-2 px-8">
                            <Save size={16} /> {editing ? 'อัปเดตแคมเปญ' : 'บันทึกโปรโมชั่น'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Grid List View */}
            {!isFormOpen && (
                <>
                    {promotions.length === 0 ? (
                        <div className="metric-card text-center py-24 flex flex-col items-center justify-center space-y-4">
                            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                <ShoppingCart size={40} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">ยังไม่มีแคมเปญโปรโมชั่น</h3>
                                <p className="text-muted-foreground">กดปุ่ม "สร้างโปรโมชั่นใหม่" เพื่อเพิ่มกลุ่มสินค้าและการกำหนดเป้าหมาย</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {promotions.map(promo => (
                                <div
                                    key={promo.id}
                                    onClick={() => { setSelectedPromotion(promo); setViewMode('detail'); }}
                                    className="bg-card border-border border-2 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group flex flex-col h-full ring-offset-background"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="h-12 w-12 rounded-xl bg-primary/5 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                            <Package size={24} />
                                        </div>
                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => startEdit(promo)}>
                                                <Pencil size={14} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={(e) => handleDelete(promo, e)}>
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold group-hover:text-primary transition-colors mb-1">{promo.name}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] mb-4">
                                            {promo.description || 'ไม่มีรายละเอียดเพิ่มเติมสำหรับแคมเปญนี้'}
                                        </p>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-border/50">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                                <Package size={14} /> สินค้า
                                            </span>
                                            <span className="font-bold">{promo.items.length} รายการ</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                                <ShoppingCart size={14} /> ยอดรวมเป้าหมาย
                                            </span>
                                            <span className="font-bold">{formatNumber(promo.items.reduce((s, i) => s + i.volume, 0))} ชิ้น</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase tracking-wider">
                                            Created {new Date(promo.created_at).toLocaleDateString()}
                                        </span>
                                        <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-bold uppercase">
                                            ดูรายละเอียด <ChevronRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
