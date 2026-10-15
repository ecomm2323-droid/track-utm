import { login } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="max-w-xs mx-auto mt-24">
      <h1 className="text-lg font-semibold mb-4">Ingresar</h1>
      <form action={login} className="space-y-3">
        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="Contraseña"
          className="w-full bg-bg border border-line rounded px-3 py-2 outline-none focus:border-accent"
        />
        {error && <p className="text-bad text-xs">Contraseña incorrecta o demasiados intentos.</p>}
        <button className="w-full px-4 py-2 rounded bg-accent text-white">Entrar</button>
      </form>
    </div>
  );
}
