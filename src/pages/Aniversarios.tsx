import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cake, Gift, Search, Users, Award, UserCheck, CalendarDays, PartyPopper } from "lucide-react";
import { format, parseISO, isSameMonth, isSameDay, differenceInYears, addYears, isAfter, isBefore, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BirthdayPerson {
  id: string;
  nome: string;
  data_nascimento: string;
  tipo: "aluno" | "profissional" | "vendedor";
  email?: string | null;
  telefone?: string | null;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const tipoConfig = {
  aluno: { label: "Aluno", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Users },
  profissional: { label: "Profissional", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: UserCheck },
  vendedor: { label: "Vendedor", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: Award },
};

function getAge(dataNascimento: string): number {
  return differenceInYears(new Date(), parseISO(dataNascimento));
}

function getNextBirthday(dataNascimento: string): Date {
  const today = startOfDay(new Date());
  const birth = parseISO(dataNascimento);
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (isBefore(next, today) && !isSameDay(next, today)) {
    next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  return next;
}

export default function Aniversarios() {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"todos" | "aluno" | "profissional" | "vendedor">("todos");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [tab, setTab] = useState("lista");

  const { data: alunos = [] } = useQuery({
    queryKey: ["aniversarios-alunos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("id, nome, data_nascimento, email, telefone").is("deleted_at", null).not("data_nascimento", "is", null);
      if (error) throw error;
      return (data || []).map(a => ({ ...a, tipo: "aluno" as const }));
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["aniversarios-profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profissionais").select("id, nome, data_nascimento, email, telefone").eq("ativo", true).is("deleted_at", null).not("data_nascimento", "is", null);
      if (error) throw error;
      return (data || []).map(p => ({ ...p, tipo: "profissional" as const }));
    },
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ["aniversarios-vendedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comerciais").select("id, nome, data_nascimento, email, telefone").eq("ativo", true).is("deleted_at", null).not("data_nascimento", "is", null);
      if (error) throw error;
      return (data || []).map(v => ({ ...v, tipo: "vendedor" as const }));
    },
  });

  const allPeople: BirthdayPerson[] = useMemo(() =>
    [...alunos, ...profissionais, ...vendedores].filter(p => p.data_nascimento),
    [alunos, profissionais, vendedores]
  );

  const today = startOfDay(new Date());

  // Aniversariantes de hoje
  const birthdayToday = useMemo(() =>
    allPeople.filter(p => {
      const d = parseISO(p.data_nascimento);
      return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    }),
    [allPeople, today]
  );

  // Próximos 7 dias
  const upcomingWeek = useMemo(() => {
    const end = addDays(today, 7);
    return allPeople.filter(p => {
      const next = getNextBirthday(p.data_nascimento);
      return isAfter(next, today) && isBefore(next, end);
    }).sort((a, b) => getNextBirthday(a.data_nascimento).getTime() - getNextBirthday(b.data_nascimento).getTime());
  }, [allPeople, today]);

  // Filtrar por mês selecionado, tipo e busca
  const filteredByMonth = useMemo(() => {
    return allPeople
      .filter(p => {
        const d = parseISO(p.data_nascimento);
        return d.getMonth() === selectedMonth;
      })
      .filter(p => filterTipo === "todos" || p.tipo === filterTipo)
      .filter(p => !search || p.nome.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => parseISO(a.data_nascimento).getDate() - parseISO(b.data_nascimento).getDate());
  }, [allPeople, selectedMonth, filterTipo, search]);

  // Datas com aniversário para o calendário
  const birthdayDates = useMemo(() => {
    const dates: Date[] = [];
    allPeople.forEach(p => {
      const d = parseISO(p.data_nascimento);
      const inCalMonth = new Date(calendarMonth.getFullYear(), d.getMonth(), d.getDate());
      if (isSameMonth(inCalMonth, calendarMonth)) {
        dates.push(inCalMonth);
      }
    });
    return dates;
  }, [allPeople, calendarMonth]);

  // Pessoas do dia selecionado no calendário
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | undefined>(undefined);
  const calendarDayPeople = useMemo(() => {
    if (!calendarSelectedDate) return [];
    return allPeople.filter(p => {
      const d = parseISO(p.data_nascimento);
      return d.getMonth() === calendarSelectedDate.getMonth() && d.getDate() === calendarSelectedDate.getDate();
    });
  }, [allPeople, calendarSelectedDate]);

  const totalByType = useMemo(() => ({
    aluno: allPeople.filter(p => p.tipo === "aluno").length,
    profissional: allPeople.filter(p => p.tipo === "profissional").length,
    vendedor: allPeople.filter(p => p.tipo === "vendedor").length,
  }), [allPeople]);

  return (
    <div className="space-y-6">
      <PageHeader title="Aniversários" description="Acompanhe os aniversários de alunos, profissionais e vendedores" />

      {/* Alertas de hoje e próximos */}
      {(birthdayToday.length > 0 || upcomingWeek.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {birthdayToday.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PartyPopper className="h-5 w-5 text-primary" />
                  Aniversariantes de Hoje! 🎂
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {birthdayToday.map(p => (
                  <div key={p.id + p.tipo} className="flex items-center justify-between rounded-lg bg-background p-3">
                    <div className="flex items-center gap-3">
                      <Cake className="h-4 w-4 text-primary" />
                      <div>
                        <span className="font-medium text-sm">{p.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2">({getAge(p.data_nascimento)} anos)</span>
                      </div>
                    </div>
                    <Badge className={tipoConfig[p.tipo].color}>{tipoConfig[p.tipo].label}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {upcomingWeek.length > 0 && (
            <Card className="border-accent/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gift className="h-5 w-5 text-accent-foreground" />
                  Próximos 7 dias
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingWeek.slice(0, 5).map(p => {
                  const next = getNextBirthday(p.data_nascimento);
                  return (
                    <div key={p.id + p.tipo} className="flex items-center justify-between rounded-lg bg-background p-3">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium text-sm">{p.nome}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {format(next, "dd/MM")} · {getAge(p.data_nascimento) + 1} anos
                          </span>
                        </div>
                      </div>
                      <Badge className={tipoConfig[p.tipo].color}>{tipoConfig[p.tipo].label}</Badge>
                    </div>
                  );
                })}
                {upcomingWeek.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+{upcomingWeek.length - 5} mais</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Cards resumo */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Cake className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allPeople.length}</p>
              <p className="text-xs text-muted-foreground">Total cadastrados</p>
            </div>
          </CardContent>
        </Card>
        {(Object.keys(tipoConfig) as Array<keyof typeof tipoConfig>).map(tipo => {
          const cfg = tipoConfig[tipo];
          const Icon = cfg.icon;
          return (
            <Card key={tipo}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalByType[tipo]}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}s</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs: Lista e Calendário */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lista">📋 Lista por Mês</TabsTrigger>
          <TabsTrigger value="calendario">📅 Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1">
              {(["todos", "aluno", "profissional", "vendedor"] as const).map(t => (
                <Button key={t} variant={filterTipo === t ? "default" : "outline"} size="sm" onClick={() => setFilterTipo(t)}>
                  {t === "todos" ? "Todos" : tipoConfig[t].label + "s"}
                </Button>
              ))}
            </div>
          </div>

          {/* Seleção de mês */}
          <div className="flex gap-2 flex-wrap">
            {MONTH_NAMES.map((name, idx) => {
              const count = allPeople.filter(p => parseISO(p.data_nascimento).getMonth() === idx && (filterTipo === "todos" || p.tipo === filterTipo)).length;
              return (
                <Button key={idx} variant={selectedMonth === idx ? "default" : "outline"} size="sm" onClick={() => setSelectedMonth(idx)} className="text-xs">
                  {name.substring(0, 3)} {count > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{count}</Badge>}
                </Button>
              );
            })}
          </div>

          {/* Tabela */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {MONTH_NAMES[selectedMonth]} — {filteredByMonth.length} aniversariante{filteredByMonth.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredByMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum aniversariante encontrado neste mês.</p>
              ) : (
                <div className="overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dia</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Idade</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredByMonth.map(p => {
                        const birth = parseISO(p.data_nascimento);
                        const isToday = birth.getMonth() === today.getMonth() && birth.getDate() === today.getDate();
                        return (
                          <TableRow key={p.id + p.tipo} className={isToday ? "bg-primary/5" : ""}>
                            <TableCell className="font-medium">
                              {format(birth, "dd")}
                              {isToday && <span className="ml-1">🎂</span>}
                            </TableCell>
                            <TableCell className="font-medium">{p.nome}</TableCell>
                            <TableCell><Badge className={tipoConfig[p.tipo].color}>{tipoConfig[p.tipo].label}</Badge></TableCell>
                            <TableCell>{getAge(p.data_nascimento)} anos</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{p.telefone || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-xs truncate max-w-[150px]">{p.email || "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendario" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <Card className="w-fit">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={calendarSelectedDate}
                  onSelect={setCalendarSelectedDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  locale={ptBR}
                  className="pointer-events-auto"
                  modifiers={{ birthday: birthdayDates }}
                  modifiersStyles={{ birthday: { fontWeight: "bold", color: "hsl(var(--primary))", textDecoration: "underline" } }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {calendarSelectedDate
                    ? `Aniversariantes em ${format(calendarSelectedDate, "dd 'de' MMMM", { locale: ptBR })}`
                    : "Selecione um dia no calendário"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!calendarSelectedDate ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Clique em um dia para ver os aniversariantes.</p>
                ) : calendarDayPeople.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum aniversariante neste dia.</p>
                ) : (
                  <div className="space-y-3">
                    {calendarDayPeople.map(p => (
                      <div key={p.id + p.tipo} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Cake className="h-4 w-4 text-primary" />
                            <span className="font-medium">{p.nome}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{getAge(p.data_nascimento)} anos</span>
                            {p.telefone && <span>📱 {p.telefone}</span>}
                            {p.email && <span>✉️ {p.email}</span>}
                          </div>
                        </div>
                        <Badge className={tipoConfig[p.tipo].color}>{tipoConfig[p.tipo].label}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
