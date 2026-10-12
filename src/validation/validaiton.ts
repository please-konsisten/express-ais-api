import type { ObjectSchema } from 'joi';

interface validateParams {
  schema: ObjectSchema; 
  request: any;
}

const validate  = ({schema, request}: validateParams) => {
    const result = schema.validate(request, {
        abortEarly: false,
        allowUnknown: false
    })
    if (result.error) {
        throw result.error;
    } else {
        return result.value;
    }
}

export {
    validate
}