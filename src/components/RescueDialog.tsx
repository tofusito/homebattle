import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Person, TaskState } from "@/lib/cleaning";

export function RescueDialog({
  pendingRescue,
  owner,
  actor,
  onCancel,
  onConfirm,
}: {
  pendingRescue: TaskState | null;
  owner: Person | null;
  actor: Person;
  onCancel: () => void;
  onConfirm: (state: TaskState) => void;
}) {
  const points = pendingRescue?.task.points ?? 0;
  return (
    <AlertDialog
      open={Boolean(pendingRescue)}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-sm rounded-[2rem] border-rescue/25 bg-card p-5">
        <AlertDialogHeader className="text-left">
          <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-rescue-soft text-2xl">
            ✨
          </div>
          <AlertDialogTitle className="font-display text-2xl">Confirmar rescate</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            <strong className="text-foreground">{pendingRescue?.task.name}</strong> era turno de{" "}
            {owner?.label}. Si confirmas, esta acción le restará {points}{" "}
            {points === 1 ? "punto" : "puntos"}. Si cancelas, no se guardará nada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-rescue-soft/65 p-3 text-center text-sm">
          <div>
            <p className="font-bold text-rescue">
              +{points} {actor.label}
            </p>
            <p className="text-xs text-muted-foreground">por rescatarla</p>
          </div>
          <div>
            <p className="font-bold text-destructive">
              −{points} {owner?.label}
            </p>
            <p className="text-xs text-muted-foreground">punto cedido</p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rescue text-white hover:bg-rescue/90"
            onClick={() => {
              if (pendingRescue) onConfirm(pendingRescue);
              onCancel();
            }}
          >
            Confirmar rescate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
