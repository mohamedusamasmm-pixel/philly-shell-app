import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Card, Field, Header, OutlineBtn, Pill, Press, Ring, Screen, Segmented, Stepper, Toggle, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { DEFAULT_TEMPLATES, ReminderRules, TrainLead, notify, useStore } from '@/data/store';
import { nm, useT } from '@/i18n';
import { today } from '@/logic/dates';
import { branchName, initials } from '@/logic/queries';
import { defaultChannel } from '@/logic/channels';
import { Reminder, VARS, templateFor } from '@/logic/reminders';
import { useReminders } from '@/logic/useReminders';
import { C } from '@/theme';

type Tab = 'pay' | 'train';

/** Reminders (design: Reminders.dc.html). The app prepares; the coach sends each with one tap. */
export default function Reminders() {
  const t = useT();
  const lang = useStore((st) => st.lang);
  const cfg = useStore((st) => st.reminders);
  const branches = useStore((st) => st.branches);
  const { pay, train } = useReminders();
  const [tab, setTab] = useState<Tab>('pay');
  const [editing, setEditing] = useState<null | 'pay' | 'train' | 'absent'>(null);
  const [draft, setDraft] = useState('');

  const rows = tab === 'pay' ? pay : train;
  const sent = rows.filter((r) => r.sent).length;
  const pct = rows.length ? Math.round((sent / rows.length) * 100) : 0;

  const send = async (r: Reminder) => {
    const ch = defaultChannel;
    if (!ch.canSend(r.player)) return notify(t('اللاعب ده مالوش رقم موبايل صحيح', 'This player has no valid mobile number'));
    if (!(await ch.send(r.player, r.message))) return notify(t('واتساب مش متسطّب', 'WhatsApp isn’t installed'));
    useStore.getState().append('reminderLogs', [{ playerId: r.player.id, kind: r.kind, reason: r.reason, message: r.message, date: today(), channel: ch.id }]);
  };
  const mute = (r: Reminder) => {
    useStore.getState().append('playerEdits', [{ playerId: r.player.id, date: today(), noReminders: true }]);
    notify(t(`${nm(r.player).split(' ')[0]} مش هيوصله تذكيرات تاني · تقدر ترجّعها من بياناته`, `No more reminders for ${nm(r.player).split(' ')[0]} · undo in their details`));
  };

  const setRule = <K extends keyof ReminderRules>(k: K, v: ReminderRules[K]) =>
    useStore.getState().set({ reminders: { ...cfg, rules: { ...cfg.rules, [k]: v } } });
  const toggleBranch = (id: string) => {
    const cur = cfg.rules.trainBranches;
    setRule('trainBranches', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const saveTemplate = () => {
    if (!editing) return;
    useStore.getState().set({ reminders: { ...cfg, templates: { ...cfg.templates, [editing]: draft.trim() || DEFAULT_TEMPLATES[lang][editing] } } });
    setEditing(null);
    notify(t('اتحفظ القالب', 'Template saved'));
  };

  const R = cfg.rules;
  const days = (n: number) => t(n === 1 ? 'يوم' : n === 2 ? 'يومين' : `${n} أيام`, n === 1 ? '1 day' : `${n} days`);
  const leadLabel = { '1h': t('بساعة', '1 hour'), '2h': t('بساعتين', '2 hours'), '1d': t('بيوم', '1 day') };
  const rules: { k: 'payBefore' | 'payDue' | 'payOverdue' | 'trainBefore' | 'trainAbsent'; label: string; meta: string; extra?: React.ReactNode }[] = tab === 'pay'
    ? [
      {
        k: 'payBefore', label: t('قبل ميعاد الدفع', 'Before the due date'), meta: t(`قبلها بـ ${days(R.payBeforeDays)}`, `${days(R.payBeforeDays)} before`),
        extra: R.payBefore ? <Stepper label={t('قبلها بكام يوم', 'Days before')} value={R.payBeforeDays} min={1} max={14} onChange={(v) => setRule('payBeforeDays', v)} /> : null,
      },
      { k: 'payDue', label: t('يوم الميعاد', 'On the due date'), meta: t('في نفس اليوم', 'Same day') },
      {
        k: 'payOverdue', label: t('بعد التأخير', 'When overdue'), meta: t(`كل ${days(R.overdueEvery)} لحد ما يدفع`, `Every ${days(R.overdueEvery)} until paid`),
        extra: R.payOverdue ? <Stepper label={t('كل كام يوم', 'Every N days')} value={R.overdueEvery} min={1} max={14} onChange={(v) => setRule('overdueEvery', v)} /> : null,
      },
    ]
    : [
      {
        k: 'trainBefore', label: t('قبل الحصة', 'Before the session'),
        meta: t(`قبلها ${leadLabel[R.trainLead]} · ${R.trainBranches.length ? R.trainBranches.map(branchName).join('، ') : 'كل الفروع'}`, `${leadLabel[R.trainLead]} before · ${R.trainBranches.length ? R.trainBranches.map(branchName).join(', ') : 'all branches'}`),
        extra: R.trainBefore ? (
          <View style={{ gap: 10 }}>
            <Segmented<TrainLead> h={34} value={R.trainLead} onChange={(v) => setRule('trainLead', v)}
              options={[{ key: '1h', label: t('ساعة', '1 hour') }, { key: '2h', label: t('ساعتين', '2 hours') }, { key: '1d', label: t('يوم', '1 day') }]} />
            <View style={[s.row, { gap: 6, flexWrap: 'wrap' }]}>
              <Pill small label={t('كل الفروع', 'All branches')} on={!R.trainBranches.length} onPress={() => setRule('trainBranches', [])} />
              {branches.map((b) => <Pill small key={b.id} label={nm(b)} on={R.trainBranches.includes(b.id)} onPress={() => toggleBranch(b.id)} />)}
            </View>
            <Txt size={11} color={C.muted}>{t('مواعيد الحصص جاية من البورتفوليو › النوادي والمواعيد', 'Session times come from Portfolio › Clubs & schedule')}</Txt>
          </View>
        ) : null,
      },
      { k: 'trainAbsent', label: t('تذكير اللاعب المنقطع', 'Absent players'), meta: t('لو غاب أكتر من 7 أيام', 'Away more than 7 days') },
    ];
  const templates: ('pay' | 'train' | 'absent')[] = tab === 'pay' ? ['pay'] : ['train', 'absent'];

  return (
    <Screen gap={14}>
      <Header title={t('التذكيرات', 'Reminders')} />

      <Segmented<Tab> h={40} value={tab} onChange={setTab}
        options={[{ key: 'pay', label: `${t('الدفع', 'Payment')} · ${pay.filter((r) => !r.sent).length}` }, { key: 'train', label: `${t('التدريب', 'Training')} · ${train.filter((r) => !r.sent).length}` }]} />

      <View style={[s.row, { backgroundColor: C.accent, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={12} color={C.bg}>{t('جاهزين للإرسال دلوقتي', 'Ready to send now')}</Txt>
          <Txt size={22} w={700} color={C.bg}>{t(`اتبعت ${sent} من ${rows.length}`, `Sent ${sent} of ${rows.length}`)}</Txt>
        </View>
        <Ring size={54} thickness={6} pct={pct} color={C.bg} track="rgba(11,12,10,.15)">
          <Txt size={13} w={700} color={C.bg}>{pct}%</Txt>
        </Ring>
      </View>

      {rows.length === 0 ? (
        <Card><Txt size={13} color={C.muted}>{tab === 'pay' ? t('مفيش تذكيرات دفع النهارده', 'No payment reminders today') : t('مفيش حصص أو غياب يستاهل تذكير النهارده', 'No sessions or absences to remind about today')}</Txt></Card>
      ) : null}

      <View style={{ gap: 10 }}>
        {rows.map((r) => (
          <View key={r.key} style={{ backgroundColor: C.surface, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, gap: 10, opacity: r.sent ? 0.6 : 1 }}>
            <View style={[s.row, { gap: 10 }]}>
              <Avatar ini={initials(nm(r.player))} uri={r.player.photoUri} size={40} />
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Txt size={14} w={500} numberOfLines={1}>{nm(r.player)}</Txt>
                <Txt size={11} color={r.tagColor}>{r.tag}</Txt>
              </View>
              {r.sent ? (
                <View style={[s.row, { height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(198,244,50,.14)', gap: 6 }]}>
                  <Icon name="check" size={14} color={C.accent} stroke={3} />
                  <Txt size={12} color={C.accent}>{t('اتبعت', 'Sent')}</Txt>
                </View>
              ) : (
                <Press onPress={() => send(r)} style={[s.row, { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.accent, gap: 6 }]}>
                  <Icon name="send" size={14} color={C.bg} stroke={2.2} />
                  <Txt size={12} w={600} color={C.bg}>{t('ابعت واتساب', 'Send WhatsApp')}</Txt>
                </Press>
              )}
            </View>
            <View style={{ backgroundColor: '#24261F', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
              <Txt size={12} color={C.text2} style={{ lineHeight: 20 }}>{r.message}</Txt>
            </View>
            {!r.sent ? (
              <Press onPress={() => mute(r)} style={{ alignSelf: 'flex-start', paddingVertical: 2 }}>
                <Txt size={11} color={C.muted}>{t('متبعتلوش تذكيرات تاني', "Don't remind this player")}</Txt>
              </Press>
            ) : null}
          </View>
        ))}
      </View>

      <View style={{ gap: 8, marginTop: 6 }}>
        <Txt size={15} w={600}>{t('إمتى التذكير يتجهّز؟', 'When are reminders prepared?')}</Txt>
        <View style={{ backgroundColor: C.surface, borderRadius: 22, overflow: 'hidden' }}>
          {rules.map((x, i) => (
            <View key={x.k} style={{ paddingVertical: 10, paddingHorizontal: 14, gap: 10, borderBottomWidth: i < rules.length - 1 ? 1 : 0, borderBottomColor: '#24261F' }}>
              <View style={[s.row, { gap: 12, minHeight: 36 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt size={14}>{x.label}</Txt>
                  <Txt size={11} color={C.muted}>{x.meta}</Txt>
                </View>
                <Toggle label={x.label} on={cfg.rules[x.k]} onChange={(v) => setRule(x.k, v)} />
              </View>
              {x.extra}
            </View>
          ))}
        </View>
      </View>

      {templates.map((k) => {
        const title = k === 'pay' ? t('قالب الرسالة', 'Message template') : k === 'train' ? t('قالب تذكير الحصة', 'Session template') : t('قالب اللاعب المنقطع', 'Absent player template');
        const vars = VARS[k].map(([ar, en]) => (lang === 'ar' ? ar : en));
        const isEditing = editing === k;
        return (
          <View key={k} style={{ gap: 8 }}>
            <View style={s.rowBetween}>
              <Txt size={15} w={600}>{title}</Txt>
              <OutlineBtn h={32} label={isEditing ? t('حفظ', 'Save') : t('تعديل', 'Edit')}
                onPress={() => (isEditing ? saveTemplate() : (setEditing(k), setDraft(templateFor(cfg, k))))} />
            </View>
            <View style={{ backgroundColor: C.surface, borderRadius: 22, padding: 14, gap: 10 }}>
              {isEditing ? (
                <Field value={draft} onChangeText={setDraft} multiline style={{ height: 110, paddingTop: 12, textAlignVertical: 'top', lineHeight: 22 }} />
              ) : (
                <Txt size={13} color="#E4E6DE" style={{ lineHeight: 23 }}>{templateFor(cfg, k)}</Txt>
              )}
              <View style={[s.row, { gap: 6, flexWrap: 'wrap' }]}>
                {vars.map((v) => (
                  <Press key={v} onPress={() => isEditing && setDraft((d) => `${d}${d.endsWith(' ') || !d ? '' : ' '}${v}`)}
                    style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.surface2, justifyContent: 'center', opacity: 1 }}>
                    <Txt size={11} color={C.accent}>{v}</Txt>
                  </Press>
                ))}
                {isEditing ? (
                  <Press onPress={() => setDraft(DEFAULT_TEMPLATES[lang][k])} style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' }}>
                    <Txt size={11} color={C.muted}>{t('رجّع الافتراضي', 'Reset')}</Txt>
                  </Press>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
