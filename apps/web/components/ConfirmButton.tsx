"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@leettrack/ui/components/alert-dialog";
import { Button } from "@leettrack/ui/components/button";

/** A button that asks first, for things that can't be undone. */
export function ConfirmButton({
  children,
  title,
  description,
  confirm,
  onConfirm,
  disabled,
  variant = "ghost",
  size = "sm",
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  onConfirm(): void;
  disabled?: boolean;
  variant?: "ghost" | "destructive" | "outline" | "secondary";
  size?: "sm" | "default";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
