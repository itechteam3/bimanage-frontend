import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Button, Dialog } from "@/components/ui";

// Ask "Leave without saving?" when a form with unsaved changes is left by a
// link, Back (in-app or browser/phone), or closing/refreshing the tab.
//
//   const guard = useLeaveGuard(formState.isDirty);
//   ...on successful save: guard.allow(); navigate(...)
//   return <>{form}{guard.dialog}</>;
//
// Changing only the query (filters) on the same page never asks.
export function useLeaveGuard(dirty: boolean) {
  const allowed = useRef(false);
  const active = dirty && !allowed.current;

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty || allowed.current) return false;
    return currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  /** Call right before navigating away after a successful save. */
  const allow = useCallback(() => {
    allowed.current = true;
  }, []);

  const open = blocker.state === "blocked";
  const stay = () => blocker.state === "blocked" && blocker.reset();
  const leave = () => blocker.state === "blocked" && blocker.proceed();

  const dialog = (
    <Dialog
      open={open}
      onClose={stay}
      tone="danger"
      icon={<IconAlertTriangle aria-hidden="true" className="size-7" />}
      title="Leave without saving?"
      description="You have changes that haven't been saved. If you leave now, they'll be lost."
      actions={
        <>
          <Button variant="destructive" onClick={leave}>
            Leave without saving
          </Button>
          <Button onClick={stay} autoFocus>
            Keep editing
          </Button>
        </>
      }
    />
  );

  return { dialog, allow, blocked: open };
}
