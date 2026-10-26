import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useWorkspace, type RegistrationInput } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Values = RegistrationInput
const products = [
  ['loans', 'Кредиты'],
  ['leasing', 'Лизинг'],
  ['guarantees', 'Банковские гарантии'],
  ['deposits', 'Депозиты'],
  ['payroll', 'Зарплатный проект'],
  ['factoring', 'Факторинг'],
  ['settlement', 'Расчётный счёт'],
] as const

export function RegistrationForm() {
  const { register: createAccount } = useWorkspace()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [countries, setCountries] = useState('')
  const form = useForm<Values>({
    mode: 'onTouched',
    defaultValues: {
      username: '',
      company: {
        name: '',
        industry: '',
        region: '',
        revenue: null,
        employees: null,
        products: {
          loans: null,
          leasing: null,
          guarantees: null,
          deposits: null,
          payroll: null,
          factoring: null,
          settlement: null,
        },
        customsCountries: [],
      },
    },
  })
  const errors = form.formState.errors
  function next() {
    const { username, company } = form.getValues()
    form.clearErrors()
    if (!username.trim()) form.setError('username', { message: 'Укажите логин' })
    else if (username.trim().length < 3) form.setError('username', { message: 'От 3 символов' })
    else if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(username.trim()))
      form.setError('username', {
        message: 'Латинские буквы, цифры, точка, дефис или подчёркивание',
      })
    else if (username.trim().toLowerCase().startsWith('client_'))
      form.setError('username', { message: 'Выберите имя без префикса client_' })
    if (company.name.trim().length < 2)
      form.setError('company.name', { message: 'Обязательное поле' })
    if (company.industry.trim().length < 2)
      form.setError('company.industry', { message: 'Обязательное поле' })
    if (company.region.trim().length < 2)
      form.setError('company.region', { message: 'Обязательное поле' })
    const { revenue, employees } = company
    if (revenue !== null && revenue !== undefined && (revenue < 0 || revenue > 1e15)) {
      form.setError('company.revenue', {
        message: revenue < 0 ? 'Выручка не может быть отрицательной' : 'Максимум — 1 000 трлн ₽',
      })
      return
    }
    if (
      employees !== null &&
      employees !== undefined &&
      !Number.isNaN(employees) &&
      (employees < 1 || employees > 10000000 || !Number.isInteger(employees))
    ) {
      form.setError('company.employees', { message: 'Укажите целое число от 1 до 10 млн' })
      return
    }
    if (
      username.trim().length >= 3 &&
      /^[a-z0-9][a-z0-9_.-]*$/i.test(username.trim()) &&
      !username.trim().toLowerCase().startsWith('client_') &&
      company.name.trim().length >= 2 &&
      company.industry.trim().length >= 2 &&
      company.region.trim().length >= 2
    )
      setStep(2)
  }
  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        if (step === 1) {
          next()
          return
        }
        setError('')
        try {
          await createAccount({
            ...values,
            company: {
              ...values.company,
              revenue: Number.isFinite(values.company.revenue) ? values.company.revenue : null,
              employees: Number.isFinite(values.company.employees)
                ? values.company.employees
                : null,
              customsCountries: [
                ...new Set(
                  countries
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                ),
              ],
            },
          })
        } catch (cause) {
          setError(errorMessage(cause))
        }
      })}
    >
      <p className="text-xs text-muted-foreground">
        Шаг {step} из 2 · {step === 1 ? 'Аккаунт и профиль' : 'Признаки для персонализации'}
      </p>
      {step === 1 ? (
        <>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-4 text-sm font-medium">Профиль пользователя</legend>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-username">Имя профиля</Label>
              <Input
                id="new-username"
                autoComplete="nickname"
                autoCapitalize="none"
                maxLength={64}
                aria-invalid={!!errors.username}
                {...form.register('username', {
                  required: 'Укажите логин',
                  minLength: { value: 3, message: 'От 3 символов' },
                  pattern: {
                    value: /^[a-z0-9][a-z0-9_.-]*$/i,
                    message: 'Латинские буквы, цифры, точка, дефис или подчёркивание',
                  },
                  validate: (v) =>
                    !v.toLowerCase().startsWith('client_') || 'Выберите логин без префикса client_',
                })}
              />
              <p className="text-xs text-muted-foreground">
                По этому имени профиль можно будет найти при следующем входе.
              </p>
              {errors.username && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>
          </fieldset>
          <fieldset className="grid gap-4 border-t pt-5 sm:grid-cols-2">
            <legend className="mb-4 text-sm font-medium">Ваша компания</legend>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company-name">Название компании</Label>
              <Input
                id="company-name"
                maxLength={160}
                aria-invalid={!!errors.company?.name}
                {...form.register('company.name', { required: true, minLength: 2 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-industry">Отрасль</Label>
              <Input
                id="company-industry"
                placeholder="Например, производство стали"
                maxLength={300}
                aria-invalid={!!errors.company?.industry}
                {...form.register('company.industry', { required: true, minLength: 2 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-region">Регион</Label>
              <Input
                id="company-region"
                placeholder="Например, Свердловская область"
                maxLength={120}
                aria-invalid={!!errors.company?.region}
                {...form.register('company.region', { required: true, minLength: 2 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-revenue">Выручка за 2025 год, ₽</Label>
              <Input
                id="company-revenue"
                type="number"
                min={0}
                max={1e15}
                step="any"
                placeholder="Необязательно"
                aria-invalid={!!errors.company?.revenue}
                {...form.register('company.revenue', {
                  setValueAs: (v) => (v === '' ? null : Number(v)),
                  validate: (value) =>
                    value === null || value === undefined || Number.isNaN(value)
                      ? true
                      : value < 0
                        ? 'Выручка не может быть отрицательной'
                        : value > 1e15
                          ? 'Максимальная выручка — 1 000 трлн ₽'
                          : true,
                })}
              />
              {errors.company?.revenue && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.company.revenue.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-employees">Численность сотрудников</Label>
              <Input
                id="company-employees"
                type="number"
                min={1}
                max={10000000}
                step={1}
                placeholder="Необязательно"
                aria-invalid={!!errors.company?.employees}
                {...form.register('company.employees', {
                  setValueAs: (v) => (v === '' ? null : Number(v)),
                  validate: (value) =>
                    value === null || value === undefined || Number.isNaN(value)
                      ? true
                      : value < 1
                        ? 'Укажите положительное число сотрудников'
                        : value > 10000000
                          ? 'Максимум — 10 млн сотрудников'
                          : Number.isInteger(value) || 'Укажите целое число сотрудников',
                })}
              />
              {errors.company?.employees && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.company.employees.message}
                </p>
              )}
            </div>
          </fieldset>
          {(errors.company?.name || errors.company?.industry || errors.company?.region) && (
            <p role="alert" className="text-xs text-destructive">
              Укажите название, отрасль и регион компании — не менее двух символов.
            </p>
          )}
          <Button className="w-full" type="button" onClick={next}>
            Продолжить
            <ArrowRight className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            Эти признаки влияют на отбор событий. Если данных нет, оставьте «Неизвестно».
          </p>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-4 text-sm font-medium">Продукты Альфа-Банка</legend>
            {products.map(([id, label]) => (
              <div key={id} className="space-y-2">
                <Label htmlFor={'product-' + id}>{label}</Label>
                <Controller
                  name={`company.products.${id}` as const}
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={
                        field.value === true ? 'yes' : field.value === false ? 'no' : 'unknown'
                      }
                      onValueChange={(value) =>
                        field.onChange(value === 'unknown' ? null : value === 'yes')
                      }
                    >
                      <SelectTrigger id={'product-' + id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Неизвестно</SelectItem>
                        <SelectItem value="yes">Есть</SelectItem>
                        <SelectItem value="no">Нет</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ))}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="customs-countries">Страны внешней торговли</Label>
            <Input
              id="customs-countries"
              placeholder="Например, Китай, Турция"
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              maxLength={1600}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Через запятую. Оставьте поле пустым, если данных нет. Направление торговли не
              предполагается.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              type="button"
              disabled={form.formState.isSubmitting}
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="size-4" />
              Назад
            </Button>
            <Button className="flex-1" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Создаём…' : 'Создать аккаунт и компанию'}
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Новый профиль сразу появится в поиске аккаунтов. Чужие компании, сохранения и диалоги в
            него не попадут.
          </p>
        </>
      )}
    </form>
  )
}
