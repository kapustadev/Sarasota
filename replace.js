const fs = require('fs');

let content = fs.readFileSync('app/purchases/page.tsx', 'utf8');

// Insert import if not exists
if (!content.includes('lucide-react')) {
  content = content.replace(
    `import { useAuth } from '../components/AuthProvider';`,
    `import { useAuth } from '../components/AuthProvider';\nimport { Plus, Building2, Globe, Truck, Search, RefreshCw, Calendar, MapPin, FileText, Package, User, Edit2, Trash2, TrendingUp, ScanBarcode, Save, Check, Users, Phone, XIcon } from 'lucide-react';`
  );
}

// Emoji replacements
const replacements = [
  { emoji: '➕', component: '<Plus size={16} />' },
  { emoji: '🏢', component: '<Building2 size={16} />' },
  { emoji: '🌍', component: '<Globe size={14} />' },
  { emoji: '🚚', component: '<Truck size={14} />' },
  { emoji: '🔍', component: '<Search size={16} />' },
  { emoji: '🔄', component: '<RefreshCw size={16} />' },
  { emoji: '📅', component: '<Calendar size={14} />' },
  { emoji: '📍', component: '<MapPin size={14} />' },
  { emoji: '📄', component: '<FileText size={14} />' },
  { emoji: '📦', component: '<Package size={14} />' },
  { emoji: '👤', component: '<User size={14} />' },
  { emoji: '✏️', component: '<Edit2 size={14} />' },
  { emoji: '🗑️', component: '<Trash2 size={14} />' },
  { emoji: '📈', component: '<TrendingUp size={16} />' },
  { emoji: '📟', component: '<ScanBarcode size={16} />' },
  { emoji: '💾', component: '<Save size={14} />' },
  { emoji: '✅', component: '<Check size={14} />' },
  { emoji: '👥', component: '<Users size={16} />' },
  { emoji: '📞', component: '<Phone size={14} />' },
  { emoji: '❌', component: '<XIcon size={14} />' }
];

replacements.forEach(r => {
  content = content.split(r.emoji).join(r.component);
});

// Disable buttons for DESIGNER
const buttonsToDisable = [
  { text: 'onClick={() => setIsSupplierModalOpen(true)}', replace: 'onClick={() => setIsSupplierModalOpen(true)}\n            disabled={userRole === \\\'DESIGNER\\\'}' },
  { text: 'onClick={openNewPurchaseModal}', replace: 'onClick={openNewPurchaseModal} disabled={userRole === \\\'DESIGNER\\\'}' },
  { text: 'onClick={() => handleReceivePurchase(p)}', replace: 'onClick={() => handleReceivePurchase(p)} disabled={userRole === \\\'DESIGNER\\\'}' },
  { text: 'onClick={() => openEditPurchaseModal(p)}', replace: 'onClick={() => openEditPurchaseModal(p)} disabled={userRole === \\\'DESIGNER\\\'}' },
  { text: 'onClick={() => handleDeletePurchase(p.id, p.supplier, p.invoiceNumber)}', replace: 'onClick={() => handleDeletePurchase(p.id, p.supplier, p.invoiceNumber)} disabled={userRole === \\\'DESIGNER\\\'}' },
  { text: 'onClick={() => handleStartEditSupplier(sup)}', replace: 'onClick={() => handleStartEditSupplier(sup)}\n                              disabled={userRole === \\\'DESIGNER\\\'}' },
  { text: 'onClick={() => handleDeleteSupplier(sup.id, sup.name)}', replace: 'onClick={() => handleDeleteSupplier(sup.id, sup.name)}\n                              disabled={userRole === \\\'DESIGNER\\\'}' },
  { text: 'onClick={handleRegisterPurchase}', replace: 'onClick={handleRegisterPurchase}\n                disabled={submitting || userRole === \\\'DESIGNER\\\'}' },
  { text: 'onClick={handleSaveSupplier}', replace: 'onClick={handleSaveSupplier}\n                      disabled={savingSupplier || userRole === \\\'DESIGNER\\\'}' }
];

buttonsToDisable.forEach(b => {
  // Use regex to avoid double-replacing
  content = content.replace(new RegExp(b.text.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '(?![\\\\s\\\\S]*?userRole === \\\'DESIGNER\\\')', 'g'), b.replace);
});

// Special case for handleRegisterPurchase and handleSaveSupplier because they already had 'disabled'
content = content.replace(
  'disabled={submitting}',
  'disabled={submitting || userRole === \\\'DESIGNER\\\'}'
);
content = content.replace(
  'disabled={savingSupplier}',
  'disabled={savingSupplier || userRole === \\\'DESIGNER\\\'}'
);

fs.writeFileSync('app/purchases/page.tsx', content);
console.log('Done!');
