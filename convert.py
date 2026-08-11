import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Brand changes
    content = content.replace('NexusCloud', 'CloudBridge')
    content = content.replace('Nexus Control', 'Admin Console')
    content = content.replace('Partner Nexus', 'Partner Portal')
    content = content.replace('Nexus AI Engine', 'Scoping Assistant')

    # Color/Theme replacements
    replacements = {
        'bg-[#0a0a0a]': 'bg-white',
        'bg-[#050505]': 'bg-slate-50',
        'border-white/5': 'border-slate-200',
        'border-white/10': 'border-slate-200',
        'border-white/20': 'border-slate-200',
        'text-white': 'text-slate-900',
        'text-slate-400': 'text-slate-500',
        'text-slate-300': 'text-slate-600',
        'text-indigo-400': 'text-blue-600',
        'text-indigo-500': 'text-blue-600',
        'text-cyan-400': 'text-blue-600',
        'text-cyan-500': 'text-blue-600',
        'text-emerald-400': 'text-emerald-600',
        'text-amber-400': 'text-amber-600',
        'text-red-400': 'text-red-600',
        'bg-indigo-500/10': 'bg-blue-50',
        'bg-indigo-500/5': 'bg-blue-50',
        'border-indigo-500/20': 'border-blue-100',
        'border-indigo-500/30': 'border-blue-200',
        'border-indigo-500/50': 'border-blue-200',
        'bg-cyan-500/10': 'bg-blue-50',
        'bg-cyan-500/5': 'bg-blue-50',
        'bg-white/5': 'bg-white',
        'bg-white/[0.01]': 'bg-white',
        'bg-white/[0.02]': 'bg-slate-50',
        'bg-white/[0.03]': 'bg-slate-100',
        'bg-white/[0.04]': 'bg-slate-100',
        'bg-black/40': 'bg-white',
        'font-black': 'font-semibold',
        'uppercase tracking-[0.2em]': '',
        'uppercase tracking-[0.3em]': '',
        'uppercase tracking-[0.4em]': '',
        'uppercase tracking-widest': '',
        'uppercase tracking-tight': 'tracking-tight',
        'text-[10px]': 'text-xs',
        'text-[9px]': 'text-xs',
        'text-[11px]': 'text-xs',
        'shadow-[0_0_15px_rgba(99,102,241,0.2)]': 'shadow-sm',
        'shadow-[0_0_15px_rgba(99,102,241,0.4)]': 'shadow-sm',
        'shadow-[0_0_20px_rgba(99,102,241,0.3)]': 'shadow-sm',
        'shadow-[0_0_10px_rgba(99,102,241,0.5)]': 'shadow-sm',
        'shadow-[0_0_20px_rgba(255,255,255,0.1)]': 'shadow-sm',
        'shadow-[0_0_15px_rgba(255,255,255,0.1)]': 'shadow-sm',
        'shadow-2xl': 'shadow-sm',
        'shadow-xl': 'shadow-sm',
        'blur-[100px]': 'hidden',
        'blur-[120px]': 'hidden',
        'via-transparent to-cyan-500/10': '',
        'opacity-50 blur-3xl pointer-events-none': 'hidden',
        'bg-indigo-600': 'bg-blue-600',
        'hover:bg-indigo-500': 'hover:bg-blue-700',
        'bg-gradient-to-b from-indigo-500 to-cyan-500': 'bg-blue-600',
        'from-indigo-500/10 to-transparent': 'bg-transparent',
        'bg-gradient-to-r from-indigo-500/20 to-cyan-500/20': 'bg-blue-50',
    }

    for old, new in replacements.items():
        content = content.replace(old, new)
        
    # Revert some of the specific uppercase stuff that looks bad
    content = content.replace('class="text-xs font-semibold  text-slate-600"', 'class="text-xs font-medium text-slate-500"')

    with open(filepath, 'w') as f:
        f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))

print("Conversion applied successfully.")
