import type { CreateAcademicTermInput } from "./academic.schema";


export const createAcademicTerm = async (input: CreateAcademicTermInput) => {
  const {
    name,
    isActive,
    endDate,
    startDate
  } = input
}