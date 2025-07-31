import 'reflect-metadata';
export declare const ENUM_TYPE_NAME_METADATA_KEY: unique symbol;
export declare const ENUM_SOURCE_PATH_METADATA_KEY: unique symbol;
export interface EnumTypeOptions {
    name: string;
    sourcePath?: string;
}
/**
 * Decorator to explicitly store the TypeScript enum type name and optionally its source path as metadata.
 *
 * Usage:
 * ```
 * // Simple usage (backward compatible)
 * @Column({ type: "enum", enum: MyEnum })
 * @EnumTypeName('MyEnum')
 * status!: MyEnum;
 *
 * // With explicit source path
 * @Column({ type: "enum", enum: MyExternalEnum })
 * @EnumTypeName({ name: 'MyExternalEnum', sourcePath: '../enums/my-external-enums' })
 * externalStatus!: MyExternalEnum;
 * ```
 *
 * @param options The string name of the Enum type, or an options object.
 */
export declare function EnumTypeName(options: EnumTypeOptions | string): PropertyDecorator;
//# sourceMappingURL=decorators.d.ts.map