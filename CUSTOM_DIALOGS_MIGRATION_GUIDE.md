# 🎯 Custom Dialogs System - Migration Guide

This guide shows you how to replace **ALL** browser `alert()` and `confirm()` dialogs in your system with beautiful custom modals that have both OK and Cancel buttons.

## ✅ What's Already Set Up

1. **Global Modal Context** - Added to `src/app/layout.tsx`
2. **Custom Modal Components** - Professional looking modals with icons and colors
3. **Custom Hook** - Easy-to-use `useCustomDialogs()` hook
4. **ProcessManager Updated** - Already converted as an example

## 🚀 How to Use in Any Component

### Step 1: Import the Hook
```typescript
import useCustomDialogs from '@/hooks/useCustomDialogs'
```

### Step 2: Use the Hook in Your Component
```typescript
const { alert, confirm, success, error, warning } = useCustomDialogs()
```

### Step 3: Replace Browser Dialogs

## Before vs After Examples

### ❌ OLD WAY (Browser dialogs)
```typescript
// Old browser alert
alert('Please fill all required fields')

// Old browser confirm
if (confirm('Are you sure you want to delete this item?')) {
  deleteItem()
}

// Old error handling
alert('Something went wrong!')
```

### ✅ NEW WAY (Custom modals)
```typescript
// New custom alert
await warning('Missing Information', 'Please fill all required fields')

// New custom confirm
const confirmed = await confirm('Confirm Deletion', 'Are you sure you want to delete this item?')
if (confirmed) {
  deleteItem()
}

// New error handling
await error('Operation Failed', 'Something went wrong!')
```

## 🎨 Available Dialog Types

### 1. Basic Alert
```typescript
await alert('Title', 'Message')
await alert('Title', 'Message', 'info', 'Custom Button Text')
```

### 2. Confirmation Dialog
```typescript
const result = await confirm('Title', 'Message')
const result = await confirm('Title', 'Message', 'warning', 'Yes', 'No')
```

### 3. Type-Specific Shortcuts
```typescript
await success('Success!', 'Operation completed successfully')
await error('Error!', 'Something went wrong')
await warning('Warning!', 'This action cannot be undone')
await info('Info', 'Here is some information')
```

### 4. Pre-built Common Dialogs
```typescript
const confirmed = await confirmDelete('customer') // Pre-built delete confirmation
const shouldSave = await confirmSave() // Pre-built save confirmation
```

## 📝 Migration Checklist for Each Component

For each component file in your system:

### 1. Add the Import
```typescript
import useCustomDialogs from '@/hooks/useCustomDialogs'
```

### 2. Add the Hook
```typescript
const { alert, confirm, success, error, warning } = useCustomDialogs()
```

### 3. Find and Replace All Dialogs

**Find:** `alert('message')`
**Replace:** `await error('Error', 'message')` or appropriate type

**Find:** `confirm('message')`
**Replace:** `const confirmed = await confirm('Confirm', 'message'); if (confirmed) { ... }`

### 4. Update Function Signatures
Since the new dialogs are async, you may need to make functions `async`:

```typescript
// Before
const handleSave = () => {
  if (confirm('Save changes?')) {
    saveData()
  }
}

// After  
const handleSave = async () => {
  const confirmed = await confirm('Save Changes', 'Save changes?')
  if (confirmed) {
    saveData()
  }
}
```

## 🎯 Common Patterns

### Form Validation Errors
```typescript
// Before
if (!name) {
  alert('Name is required')
  return
}

// After
if (!name) {
  await error('Validation Error', 'Name is required')
  return
}
```

### Delete Confirmations
```typescript
// Before
if (confirm('Delete this item?')) {
  deleteItem()
}

// After
const confirmed = await confirmDelete('item')
if (confirmed) {
  deleteItem()
}
```

### Success Messages
```typescript
// Before
alert('Item saved successfully!')

// After
await success('Saved!', 'Item saved successfully!')
```

### API Error Handling
```typescript
// Before
try {
  await apiCall()
} catch (error) {
  alert('API call failed')
}

// After
try {
  await apiCall()
} catch (err) {
  await error('Connection Error', 'API call failed. Please try again.')
}
```

## 🎨 Dialog Types and Colors

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `info` | ℹ️ | Blue | Information messages |
| `warning` | ⚠️ | Yellow | Warnings, confirmations |
| `error` | ❌ | Red | Errors, failures |
| `success` | ✅ | Green | Success messages |

## 🔍 Files to Update

Search your codebase for these patterns and update them:

1. **Search for:** `alert(`
2. **Search for:** `confirm(`  
3. **Search for:** `window.alert(`
4. **Search for:** `window.confirm(`

### Suggested Update Order:
1. Start with frequently used components
2. Update form validation components
3. Update API call components
4. Update delete/save operations
5. Update utility functions

## 📂 Example Files Already Updated:
- ✅ `src/components/ProcessManager.tsx` - Fully converted
- ⏳ `src/components/examples/CustomDialogExamples.tsx` - Reference examples

## 🚨 Important Notes:

1. **All functions using custom dialogs must be `async`**
2. **Always `await` the dialog calls**
3. **Confirm dialogs return `Promise<boolean>`**
4. **Alert dialogs return `Promise<void>`**
5. **The modals are automatically managed by the global context**

## 🎉 Benefits After Migration:

✅ **Professional UI** - Beautiful modals instead of ugly browser dialogs  
✅ **Consistent Design** - Same look throughout your entire app  
✅ **Better UX** - Clear icons, colors, and button labels  
✅ **Mobile Friendly** - Responsive design that works on all devices  
✅ **Customizable** - Easy to modify colors, text, and behavior  
✅ **Both OK and Cancel** - Every confirmation has both options  

## 💡 Pro Tips:

- Use `success()` for positive actions
- Use `error()` for failures and validation errors  
- Use `warning()` for confirmations and warnings
- Use `info()` for neutral information
- Use `confirmDelete()` for delete operations
- Custom button text makes dialogs more user-friendly

Now you have a complete system to replace ALL browser dialogs in your application with beautiful, professional custom modals! 🚀
