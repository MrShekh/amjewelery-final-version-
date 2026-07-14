# Quick Reference: Process Update Feature

## 🎯 Problem Solved
You can now **update input and output weights** of ANY process (even completed ones) after the next process has started. Loss is automatically recalculated.

## 📍 Where to Find It
1. Go to Order Details page
2. Look at "Process Status Overview" section
3. Find either:
   - **"🔄 In Progress"** section (for started processes)
   - **"✅ Completed"** section (for completed processes)
4. Click **"✏️ Edit Process"** button on any process

## 🔧 What You Can Update

### For All Processes:
- ✅ **Input Weight** (in grams)
- ✅ **Output Weight** (in grams)
- ✅ **Loss** (automatically calculated as: Input - Output)

### For Stone Setting Process:
- ✅ **AD Stones** (size, pieces, weight)
- ✅ **Kales Stones** (size, pieces, weight)
- ✅ Input weight automatically updates when stones are added

## 📊 Example Scenarios

### Scenario 1: Increase Input Weight
```
BEFORE:
Filing: Input 12g → Output 11.5g → Loss 0.5g

UPDATE:
Change input to 13g

AFTER:
Filing: Input 13g → Output 11.5g → Loss 1.5g ✅
```

### Scenario 2: Decrease Output Weight
```
BEFORE:
Filing: Input 12g → Output 11.5g → Loss 0.5g

UPDATE:
Change output to 11g

AFTER:
Filing: Input 12g → Output 11g → Loss 1g ✅
```

### Scenario 3: Update Both
```
BEFORE:
Filing: Input 12g → Output 11.5g → Loss 0.5g

UPDATE:
Change input to 13g AND output to 12g

AFTER:
Filing: Input 13g → Output 12g → Loss 1g ✅
```

## ⚡ Automatic Updates

When you edit a process, these values update **automatically**:
1. ✅ Process loss (Input - Output)
2. ✅ Order total weight loss (sum of all process losses)
3. ✅ Order actual final weight (output of last completed process)

## 🛡️ Validation Rules

- ❌ Input weight must be greater than 0
- ❌ Output weight cannot be negative
- ❌ Output weight cannot exceed input weight (except stone setting)
- ❌ For stone setting: output can exceed input due to stones

## 💡 Best Practices

1. **Double-check weights** before saving (changes are immediate)
2. **Update chronologically** if multiple processes need changes
3. **Verify next process** input weight matches previous output
4. **Document reason** in your notes if making significant changes

## 🎨 Visual Guide

```
┌─────────────────────────────────────────────┐
│  ✅ Completed (1)                          │
├─────────────────────────────────────────────┤
│  FILING                        ← LATEST     │
│  Karigar: Hasan bhai                        │
│  12.000g → 11.500g (Loss: 0.500g)          │
│                                             │
│                         [Completed]         │
│                         [✏️ Edit Process] ← CLICK HERE
└─────────────────────────────────────────────┘
```

## 🔄 Step-by-Step Process

1. **Click** "✏️ Edit Process" button
2. **Modal opens** showing current values
3. **Update** input or output weight
4. **Watch** loss calculate in real-time
5. **Click** "✅ Update Process" to save
6. **See** updated values immediately
7. **Order totals** update automatically

## ⚠️ Important Notes

- Changes are **immediate** and **permanent**
- All updates are **logged** with timestamp
- You can edit processes **in any order**
- Works for **all process types**: Filing, Free Polish, Stone Setting, Final Polish
- **No need to delete** and recreate processes anymore

## 🆘 Troubleshooting

### "Output cannot exceed input" error
- For normal processes: Reduce output or increase input
- For stone setting: Make sure stones are added to allow output > input

### Changes not showing
- Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
- Check if process is actually completed or started

### Wrong total loss showing
- All process losses sum to total loss
- Check each individual process for correct weights
- Edit and save to recalculate

## 📞 Need Help?
If you encounter any issues or have questions about this feature, refer to the detailed documentation in `PROCESS_UPDATE_FEATURE.md`.
