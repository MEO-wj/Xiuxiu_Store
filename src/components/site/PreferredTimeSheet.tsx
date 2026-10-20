"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { BottomSheet } from "./BottomSheet";

const QUICK_OPTIONS = ["尽快", "今天", "明天"];
function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
type Props = { open: boolean; onClose: () => void; value: string; onChange: (value: string) => void };

// Mount a fresh draft for each opening. Closing discards unconfirmed edits.
export function PreferredTimeSheet(props: Props) {
  return props.open ? <TimeDraft {...props} /> : null;
}

function TimeDraft({ open, onClose, value, onChange }: Props) {
  const custom = !QUICK_OPTIONS.includes(value);
  const [choice, setChoice] = useState(custom ? "custom" : value);
  const [date, setDate] = useState(custom ? value.slice(0, 10) : localDate(1));
  const [time, setTime] = useState(custom ? value.slice(11, 16) : "14:00");
  const [error, setError] = useState("");

  const confirm = () => {
    if (choice === "custom" && (!date || !time || new Date(`${date}T${time}`).getTime() <= Date.now())) {
      setError("请选择一个未来的日期和时间");
      return;
    }
    onChange(choice === "custom" ? `${date} ${time}` : choice);
    onClose();
  };

  return <BottomSheet open={open} onClose={onClose} title="选择期望时间">
    <fieldset className="time-options"><legend className="sr-only">期望时间</legend>{[...QUICK_OPTIONS, "custom"].map(option => <label key={option}>
      <span>{option === "custom" ? "指定日期与时间" : option}</span><input type="radio" name="preferred-time" value={option} checked={choice === option} onChange={() => { setChoice(option); setError(""); }} />
    </label>)}</fieldset>
    {choice === "custom" && <div className="custom-time">
      <label>日期<input type="date" min={localDate()} value={date} onChange={e => { setDate(e.target.value); setError(""); }} /></label>
      <label>时间<input type="time" value={time} onChange={e => { setTime(e.target.value); setError(""); }} /></label>
    </div>}
    {error && <p role="alert" className="mb-3 text-footnote text-danger">{error}</p>}
    <p className="time-footnote">这是你的期望时间，具体安排会在联系时与你确认。</p>
    <Button block onClick={confirm}>确认时间</Button>
  </BottomSheet>;
}
