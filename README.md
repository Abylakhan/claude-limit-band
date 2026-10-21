# limit-band

Мод для Claude Code: строка над полем ввода показывает, сколько осталось лимита Claude (5-часовое и недельное окно) — шкалой, процентом и временем сброса — и дату следующей оплаты подписки с числом дней до неё (время по Алматы, UTC+5). День оплаты по умолчанию 23-е, меняется командой `/billing <день>`; `/billing` без числа сбрасывает дату.

Лимиты видны только на платной подписке (Pro/Max) и появляются после первого ответа модели.

## Установка

В терминальной сессии Claude Code:

```
/plugin install limit-band --marketplace Abylakhan/claude-limit-band
```

Из обычного терминала:

```
claude plugin install limit-band --marketplace Abylakhan/claude-limit-band
```

В десктопном приложении, где `/plugin` не работает: «+» рядом с полем ввода → Plugins → Add marketplace с `Abylakhan/claude-limit-band` → Add plugin.
