// Shared by both adapters: two independent model sessions can otherwise exhaust a tab's memory.
let occupied = false;
export function acquireImageToolSlot(): () => void {
  if (occupied) throw new Error("Another image tool is already running. Wait or cancel it first.");
  occupied = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    occupied = false;
  };
}
