export const toSkipTake = ({ page, limit }: { page: number; limit: number }) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const pageMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});