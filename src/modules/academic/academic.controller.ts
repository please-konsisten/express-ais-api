import type { Request, Response } from "express";
import * as academicService from "./academic.service";
import type { CreateAcademicTermInput } from "./academic.schema";


const createAcademicTerm = async (req: Request, res:Response) => {
  const data = await academicService.createAcademicTerm(req.body as CreateAcademicTermInput)
}