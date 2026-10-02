import {
  type BlindPayCreatedCustomer,
  type BlindPayGateway,
  BlindPayProviderError,
  type BlindPayRfi,
  type BlindPayRfiAnswers,
  type BlindPayTermsSession,
  type BlindPayUploadedDocument,
} from "./blindpay.types";

interface BlindPayHttpGatewayOptions {
  apiKey: string;
  instanceId: string;
  baseUrl: string;
  timeoutMs: number;
}

interface RequestOptions {
  method: "GET" | "POST";
  body?: string | FormData;
  contentType?: string;
  idempotencyKey?: string;
  allowNotFound?: boolean;
}

export class BlindPayHttpGateway implements BlindPayGateway {
  constructor(private readonly options: BlindPayHttpGatewayOptions) {}

  async createTermsOfServiceUrl(input: {
    idempotencyKey: string;
    redirectUrl: string;
  }): Promise<BlindPayTermsSession> {
    const response = await this.requestJson(
      `/e/instances/${this.options.instanceId}/tos`,
      "create_terms_session",
      {
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          idempotency_key: input.idempotencyKey,
          customer_id: null,
          redirect_url: input.redirectUrl,
        }),
      },
    );
    const data = this.unwrap(response, "create_terms_session");
    const url = this.requiredString(data, "url", "create_terms_session");
    const parsedUrl = this.parseHttpsUrl(url, "create_terms_session");

    if (parsedUrl.hostname !== "app.blindpay.com") {
      throw new BlindPayProviderError("create_terms_session_invalid_response", false);
    }

    return { url: parsedUrl.toString() };
  }

  async uploadDocument(
    input: { filename: string; mimeType: string; content: Buffer },
    idempotencyKey: string,
  ): Promise<BlindPayUploadedDocument> {
    const form = new FormData();
    form.append("bucket", "onboarding");
    form.append("file", new Blob([input.content], { type: input.mimeType }), input.filename);

    const response = await this.requestJson(
      `/upload?instance_id=${encodeURIComponent(this.options.instanceId)}`,
      "upload_document",
      { method: "POST", body: form, idempotencyKey },
    );
    const data = this.unwrap(response, "upload_document");
    const fileUrl = this.requiredString(data, "file_url", "upload_document");
    const parsedUrl = this.parseHttpsUrl(fileUrl, "upload_document");

    if (parsedUrl.hostname !== "files.blindpay.com") {
      throw new BlindPayProviderError("upload_document_invalid_response", false);
    }

    return { fileUrl: parsedUrl.toString() };
  }

  async createCustomer(
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BlindPayCreatedCustomer> {
    const response = await this.requestJson(
      `/instances/${this.options.instanceId}/customers`,
      "create_customer",
      {
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(input),
        idempotencyKey,
      },
    );
    const data = this.unwrap(response, "create_customer");
    const id = this.requiredString(data, "id", "create_customer");

    if (!id.startsWith("re_")) {
      throw new BlindPayProviderError("create_customer_invalid_response", false);
    }

    return { id };
  }

  async getOpenRfi(customerId: string): Promise<BlindPayRfi | null> {
    const response = await this.requestJson(
      `/instances/${this.options.instanceId}/customers/${encodeURIComponent(customerId)}/rfi`,
      "get_rfi",
      { method: "GET", allowNotFound: true },
    );

    if (response === null) {
      return null;
    }

    return this.toRfi(this.unwrap(response, "get_rfi"));
  }

  async submitRfi(
    customerId: string,
    answers: BlindPayRfiAnswers,
    idempotencyKey: string,
  ): Promise<void> {
    await this.requestJson(
      `/instances/${this.options.instanceId}/customers/${encodeURIComponent(customerId)}/rfi`,
      "submit_rfi",
      {
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(answers),
        idempotencyKey,
      },
    );
  }

  private async requestJson(
    path: string,
    operation: string,
    options: RequestOptions,
  ): Promise<unknown | null> {
    const headers = new Headers({ Authorization: `Bearer ${this.options.apiKey}` });
    if (options.contentType !== undefined) {
      headers.set("Content-Type", options.contentType);
    }
    if (options.idempotencyKey !== undefined) {
      headers.set("Idempotency-Key", options.idempotencyKey);
    }

    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method: options.method,
        headers,
        ...(options.body === undefined ? {} : { body: options.body }),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch {
      throw new BlindPayProviderError(operation, true);
    }

    if (options.allowNotFound === true && response.status === 404) {
      return null;
    }

    const payload = await this.parseJson(response, operation);
    if (!response.ok) {
      const providerCode = this.optionalString(payload, "code");
      throw new BlindPayProviderError(
        operation,
        response.status === 429 || response.status >= 500,
        response.status,
        providerCode,
      );
    }

    return payload;
  }

  private async parseJson(response: Response, operation: string): Promise<unknown> {
    const text = await response.text();
    if (text.length === 0) {
      return {};
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BlindPayProviderError(`${operation}_invalid_response`, false, response.status);
    }
  }

  private unwrap(value: unknown, operation: string): Record<string, unknown> {
    const object = this.asObject(value, operation);
    if ("data" in object) {
      return this.asObject(object.data, operation);
    }
    return object;
  }

  private toRfi(value: unknown): BlindPayRfi {
    const object = this.asObject(value, "get_rfi");
    const request = object.request;
    if (!Array.isArray(request)) {
      throw new BlindPayProviderError("get_rfi_invalid_response", false);
    }

    const status = this.requiredString(object, "status", "get_rfi");
    if (!(["pending", "submitted", "expired", "cancelled"] as string[]).includes(status)) {
      throw new BlindPayProviderError("get_rfi_invalid_response", false);
    }

    return {
      id: this.requiredString(object, "id", "get_rfi"),
      status: status as BlindPayRfi["status"],
      request: request.map((section) => this.toRfiSection(section)),
      expiresAt: this.requiredString(object, "expires_at", "get_rfi"),
      createdAt: this.requiredString(object, "created_at", "get_rfi"),
    };
  }

  private toRfiSection(value: unknown): BlindPayRfi["request"][number] {
    const section = this.asObject(value, "get_rfi");
    if (!Array.isArray(section.fields)) {
      throw new BlindPayProviderError("get_rfi_invalid_response", false);
    }

    const supportingDocument = this.optionalString(section, "supporting_document");
    return {
      title: this.requiredString(section, "title", "get_rfi"),
      description: this.requiredString(section, "description", "get_rfi"),
      ...(supportingDocument === undefined ? {} : { supportingDocument }),
      fields: section.fields.map((field) => this.toRfiField(field)),
    };
  }

  private toRfiField(value: unknown): BlindPayRfi["request"][number]["fields"][number] {
    const field = this.asObject(value, "get_rfi");
    if (typeof field.required !== "boolean") {
      throw new BlindPayProviderError("get_rfi_invalid_response", false);
    }

    const regex = this.optionalString(field, "regex");
    const multiple = typeof field.multiple === "boolean" ? field.multiple : undefined;
    const items = Array.isArray(field.items)
      ? field.items.map((item) => {
          const option = this.asObject(item, "get_rfi");
          return {
            label: this.requiredString(option, "label", "get_rfi"),
            value: this.requiredString(option, "value", "get_rfi"),
          };
        })
      : undefined;

    return {
      key: this.requiredString(field, "key", "get_rfi"),
      label: this.requiredString(field, "label", "get_rfi"),
      required: field.required,
      ...(regex === undefined ? {} : { regex }),
      ...(multiple === undefined ? {} : { multiple }),
      ...(items === undefined ? {} : { items }),
    };
  }

  private parseHttpsUrl(value: string, operation: string): URL {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
      return url;
    } catch {
      throw new BlindPayProviderError(`${operation}_invalid_response`, false);
    }
  }

  private asObject(value: unknown, operation: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new BlindPayProviderError(`${operation}_invalid_response`, false);
    }
    return value as Record<string, unknown>;
  }

  private requiredString(object: Record<string, unknown>, key: string, operation: string): string {
    const value = this.optionalString(object, key);
    if (value === undefined) {
      throw new BlindPayProviderError(`${operation}_invalid_response`, false);
    }
    return value;
  }

  private optionalString(object: unknown, key: string): string | undefined {
    if (typeof object !== "object" || object === null || Array.isArray(object)) {
      return undefined;
    }
    const value = (object as Record<string, unknown>)[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}
