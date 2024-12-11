"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [time, setTime] = useState<Date | undefined>();
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 100);
    return () => clearInterval(interval);
  });
  return <div className="grid h-screen place-items-center font-sans">
    <span className="sr-only">The current time is&nbsp;</span>
    {time && time.toLocaleString()}
  </div>;
}
