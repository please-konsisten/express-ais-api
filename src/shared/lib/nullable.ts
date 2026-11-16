// Field opsional boleh dikirim "" untuk mengosongkan, tapi di database harus NULL.
// undefined dibiarkan undefined (artinya "tidak diubah").
export const emptyToNull = <T extends string | null | undefined>(value: T): Exclude<T, ""> | null | undefined =>
  (value === "" ? null : value) as Exclude<T, ""> | null | undefined;
