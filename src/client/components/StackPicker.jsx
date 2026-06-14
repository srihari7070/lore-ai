// Visual stack selector. Choices become hard constraints in the compiled output.
const CATEGORIES = {
  Frameworks: ['Next.js', 'React', 'Vue', 'Svelte', 'Express', 'Fastify', 'NestJS', 'Django', 'FastAPI'],
  Databases: ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis', 'Supabase'],
  Languages: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust'],
  ORMs: ['Prisma', 'Drizzle', 'TypeORM', 'Mongoose', 'SQLAlchemy'],
  Auth: ['Clerk', 'Auth.js', 'Supabase Auth', 'Firebase Auth', 'Custom JWT'],
};

export default function StackPicker({ selected = [], onChange }) {
  const toggle = (item) => {
    onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item]);
  };

  return (
    <div className="space-y-3">
      <label className="text-xs uppercase tracking-wide text-text-muted">Stack (hard constraints)</label>
      {Object.entries(CATEGORIES).map(([category, items]) => (
        <div key={category}>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted/70">{category}</div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => {
              const active = selected.includes(item);
              return (
                <button
                  key={item}
                  onClick={() => toggle(item)}
                  className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
                    active
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-white/10 text-text-muted hover:border-accent/40'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
