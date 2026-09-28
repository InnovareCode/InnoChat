import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Política de privacidade — InnoChat" };

export default function PrivacidadePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Política de privacidade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">Texto a definir pelo responsável.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
