import type { Person, PersonId } from "@/lib/cleaning";
import { APP_NAME } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function PersonPicker({
  people,
  onChoose,
}: {
  people: Person[];
  onChoose: (person: PersonId) => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="animate-rise-in">
        <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-primary uppercase">
          Happy Home
        </p>
        <h1 className="mt-3 text-4xl leading-[1.05] font-semibold text-balance-tight">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Antes de nada: ¿quién eres? Sin contraseñas, sin dramas. Este móvil recordará tu elección.
        </p>
      </div>
      <div className="mt-9 grid gap-3">
        {people.map((person, index) => (
          <button
            key={person.id}
            type="button"
            onClick={() => onChoose(person.id)}
            className={cn(
              "animate-rise-in card-soft tap-shrink flex items-center gap-4 rounded-2xl p-5 text-left",
              person.id === "lucy"
                ? "hover:border-lucy/60 hover:bg-lucy-soft/50"
                : "hover:border-manu/60 hover:bg-manu-soft/50",
            )}
            style={{ animationDelay: `${120 + index * 90}ms` }}
          >
            <span
              className={cn(
                "grid size-14 place-items-center rounded-full text-2xl",
                person.id === "lucy" ? "bg-lucy-soft" : "bg-manu-soft",
              )}
            >
              {person.emoji}
            </span>
            <span>
              <span className="block text-xl font-semibold">{person.label}</span>
              <span className="block text-sm text-muted-foreground">
                {person.id === "lucy"
                  ? "Unicornio doméstico en servicio"
                  : "Gato doméstico en servicio"}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Podrás cambiar de persona cuando quieras.
      </p>
    </main>
  );
}
