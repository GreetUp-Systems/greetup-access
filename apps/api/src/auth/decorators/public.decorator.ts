import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_ROUTE = "access:is-public-route";
export const Public = (): ClassDecorator & MethodDecorator => SetMetadata(IS_PUBLIC_ROUTE, true);
