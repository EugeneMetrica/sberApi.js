import { Type, Static } from '@sinclair/typebox';

/**
 * Схема для подписи платежа
 */
export const DigestSignatureSchema = Type.Object({
  base64Encoded: Type.String(),
  certificateUuid: Type.String({ format: 'uuid' }),
});

/**
 * Схема НДС
 */
export const VatSchema = Type.Object({
  type: Type.Union([Type.Literal('INCLUDED'), Type.Literal('EXCLUDED'), Type.Literal('NONE')]),
  rate: Type.Union([Type.String(), Type.Number()]),
  amount: Type.Number(),
});

/**
 * Схема платежного поручения
 */
export const PaymentRequestSchema = Type.Object({
  date: Type.String({ format: 'date' }),
  amount: Type.Number({ minimum: 0 }),
  deliveryKind: Type.String(),
  urgencyCode: Type.String(),
  operationCode: Type.String(),
  payeeAccount: Type.String(),
  payeeBankBic: Type.String(),
  payeeBankCorrAccount: Type.String(),
  payeeInn: Type.String(),
  payeeName: Type.String(),
  payeeKpp: Type.Optional(Type.String()),
  payerAccount: Type.String(),
  payerBankBic: Type.String(),
  payerBankCorrAccount: Type.String(),
  payerInn: Type.String(),
  payerName: Type.String(),
  priority: Type.String(),
  purpose: Type.String(),
  externalId: Type.String({ format: 'uuid' }),
  digestSignatures: Type.Array(DigestSignatureSchema),
  vat: Type.Optional(VatSchema),
  departmentalInfo: Type.Optional(Type.Object({
    docNumber108: Type.String(),
    oktmo: Type.String(),
    reasonCode106: Type.String(),
    uip: Type.String(),
    taxPeriod107: Type.String(),
    drawerStatus101: Type.String(),
    docDate109: Type.String(),
    kbk: Type.String(),
  })),
});

export type PaymentRequest = Static<typeof PaymentRequestSchema>;
