"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { parseYYYYMMDD, formatDateToYYYYMMDD } from "@/lib/dateUtils"

function formatDate(date: Date | undefined) {
  if (!date) {
    return ""
  }
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false
  }
  return !isNaN(date.getTime())
}

interface DatePickerProps {
  value?: string; // YYYYMMDD format
  onChange?: (value: string) => void; // Returns YYYYMMDD format
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "June 01, 2025",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parse YYYYMMDD to Date object (handle null -> undefined)
  const date = value ? parseYYYYMMDD(value) ?? undefined : undefined
  const [month, setMonth] = React.useState<Date | undefined>(date)
  const [inputValue, setInputValue] = React.useState(formatDate(date))

  // Update input value when external value changes
  React.useEffect(() => {
    const newDate = value ? parseYYYYMMDD(value) ?? undefined : undefined
    setInputValue(formatDate(newDate))
    setMonth(newDate)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value
    setInputValue(inputVal)

    // Try to parse the input as a date
    const parsedDate = new Date(inputVal)
    if (isValidDate(parsedDate) && onChange) {
      const yyyymmdd = formatDateToYYYYMMDD(parsedDate)
      onChange(yyyymmdd)
      setMonth(parsedDate)
    }
  }

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    if (selectedDate && onChange) {
      const yyyymmdd = formatDateToYYYYMMDD(selectedDate)
      onChange(yyyymmdd)
      setInputValue(formatDate(selectedDate))
      setOpen(false)
    }
  }

  return (
    <div className={cn("relative flex gap-2", className)}>
      <Input
        value={inputValue}
        placeholder={placeholder}
        className="bg-background pr-10"
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setOpen(true)
          }
        }}
        disabled={disabled}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
            disabled={disabled}
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">Select date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden p-0"
          align="end"
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            mode="single"
            selected={date || undefined}
            captionLayout="dropdown"
            month={month}
            onMonthChange={setMonth}
            onSelect={handleCalendarSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

