import type { ObjectSchema, NumberSchema, StringSchema } from 'joi';

const validate = (
    schema: ObjectSchema | NumberSchema | StringSchema ,
    request: any
): any => {
    const result = schema.validate(request, {
        abortEarly: false,
        allowUnknown: false
    });
    
    if (result.error) {
        throw result.error;
    }
    
    return result.value;
};

export {
    validate
};
