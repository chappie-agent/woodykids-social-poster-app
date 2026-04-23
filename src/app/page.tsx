import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const platforms = [
  { id: "instagram", label: "Instagram", emoji: "📸", color: "bg-pink-100 text-pink-700" },
  { id: "facebook", label: "Facebook", emoji: "📘", color: "bg-blue-100 text-blue-700" },
  { id: "tiktok", label: "TikTok", emoji: "🎵", color: "bg-slate-100 text-slate-700" },
  { id: "linkedin", label: "LinkedIn", emoji: "💼", color: "bg-cyan-100 text-cyan-700" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FFF8F0] font-sans">
      {/* Header */}
      <header className="border-b border-orange-100 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪵</span>
            <span className="text-xl font-bold tracking-tight text-orange-900">
              WoodyKids <span className="text-orange-500">Poster</span>
            </span>
          </div>
          <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs px-3 py-1">
            Beta
          </Badge>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <p className="text-sm font-semibold tracking-widest text-orange-400 uppercase mb-4">
          Social Media Made Simple
        </p>
        <h1 className="text-5xl font-extrabold text-orange-900 leading-tight mb-5">
          Maak posts voor<br />
          <span className="text-orange-500">alle platformen</span> tegelijk
        </h1>
        <p className="text-lg text-orange-800/60 max-w-xl mx-auto">
          Schrijf één keer, publiceer overal. Perfect voor WoodyKids content.
        </p>
      </section>

      {/* Composer */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Editor */}
          <Card className="lg:col-span-3 border-orange-100 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-orange-900">✍️ Jouw bericht</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select>
                <SelectTrigger className="border-orange-200 focus:ring-orange-300">
                  <SelectValue placeholder="Kies platform..." />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.emoji} {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Schrijf hier je post..."
                className="min-h-[180px] border-orange-200 focus-visible:ring-orange-300 resize-none text-orange-900 placeholder:text-orange-300"
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-orange-400">0 / 280 tekens</span>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6">
                  Publiceren →
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Platforms */}
          <div className="lg:col-span-2 space-y-4">
            <p className="text-xs font-semibold tracking-widest text-orange-400 uppercase px-1">
              Platformen
            </p>
            {platforms.map((p) => (
              <Card
                key={p.id}
                className="border-orange-100 shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer"
              >
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="font-semibold text-orange-900">{p.label}</span>
                  </div>
                  <Badge className={`${p.color} border-0 text-xs font-medium`}>
                    Verbinden
                  </Badge>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed border-orange-200 bg-transparent shadow-none">
              <CardContent className="py-4 text-center text-sm text-orange-300">
                + Platform toevoegen
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
