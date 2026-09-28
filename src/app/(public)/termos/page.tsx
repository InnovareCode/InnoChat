import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Termos de uso — InnoChat" };

export default function TermosPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Termos de uso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">Texto a definir pelo responsável.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
