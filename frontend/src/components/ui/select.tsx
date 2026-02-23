import * as React from "react"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Native <select> drop-down that delegates look & feel to the OS.   */
/*  API is kept compatible with the Radix-based component so existing */
/*  consumer code (Select / SelectTrigger / SelectValue / …) still    */
/*  compiles without changes.                                         */
/* ------------------------------------------------------------------ */

// ── Context ──────────────────────────────────────────────────────────
interface SelectContextType {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  // Refs populated synchronously during render by SelectTrigger / SelectValue
  _triggerClassName: React.MutableRefObject<string>
  _triggerStyle: React.MutableRefObject<React.CSSProperties | undefined>
  _placeholder: React.MutableRefObject<string>
}

const SelectContext = React.createContext<SelectContextType | null>(null)

// ── Select (root wrapper) ────────────────────────────────────────────
interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  disabled?: boolean
  children: React.ReactNode
  // Radix-compat props (ignored for native select)
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function Select({ value, onValueChange, defaultValue, disabled, children }: SelectProps) {
  const _triggerClassName = React.useRef("")
  const _triggerStyle = React.useRef<React.CSSProperties | undefined>(undefined)
  const _placeholder = React.useRef("")

  return (
    <SelectContext.Provider
      value={{
        value: value ?? defaultValue,
        onValueChange,
        disabled,
        _triggerClassName,
        _triggerStyle,
        _placeholder,
      }}
    >
      {children}
    </SelectContext.Provider>
  )
}

// ── SelectGroup ──────────────────────────────────────────────────────
function SelectGroup({ children, ...props }: React.HTMLAttributes<HTMLOptGroupElement>) {
  return <optgroup {...(props as React.OptgroupHTMLAttributes<HTMLOptGroupElement>)}>{children}</optgroup>
}

// ── SelectValue (captures placeholder text, renders nothing) ─────────
function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext)
  if (ctx) ctx._placeholder.current = placeholder || ""
  return null
}

// ── SelectTrigger (captures className / style, hidden in DOM) ────────
const SelectTrigger = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }
>(({ className, style, children, ...props }, ref) => {
  const ctx = React.useContext(SelectContext)
  if (ctx) {
    ctx._triggerClassName.current = className || ""
    ctx._triggerStyle.current = style
  }
  // Render children in a screen-reader-only span so SelectValue can execute
  return (
    <span ref={ref} className="sr-only">
      {children}
    </span>
  )
})
SelectTrigger.displayName = "SelectTrigger"

// ── SelectContent (renders native <select>) ──────────────────────────
const SelectContent = React.forwardRef<
  HTMLSelectElement,
  React.HTMLAttributes<HTMLSelectElement> & {
    children?: React.ReactNode
    position?: string // Radix-compat (ignored)
  }
>(({ className, children, position, style, ...props }, ref) => {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  const {
    value,
    onValueChange,
    disabled,
    _triggerClassName,
    _triggerStyle,
    _placeholder,
  } = ctx

  return (
    <select
      ref={ref}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
      className={cn(
        "h-9 w-full cursor-pointer rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-sm shadow-sm ring-offset-background hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        _triggerClassName.current,
        className,
      )}
      style={{ ..._triggerStyle.current, ...style }}
      {...props}
    >
      {_placeholder.current && (
        <option value="" disabled>
          {_placeholder.current}
        </option>
      )}
      {children}
    </select>
  )
})
SelectContent.displayName = "SelectContent"

// ── SelectItem (native <option>) ─────────────────────────────────────
const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <option ref={ref} {...props}>
    {children}
  </option>
))
SelectItem.displayName = "SelectItem"

// ── SelectLabel (disabled option used as a group header) ─────────────
const SelectLabel = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, children, ...props }, ref) => (
  <option ref={ref} disabled {...props}>
    {children}
  </option>
))
SelectLabel.displayName = "SelectLabel"

// ── No-ops (not applicable for native select) ───────────────────────
const SelectSeparator = () => null
const SelectScrollUpButton = () => null
const SelectScrollDownButton = () => null

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
