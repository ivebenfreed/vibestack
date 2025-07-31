import 'reflect-metadata';
// Define a unique key for the metadata
export const ENUM_TYPE_NAME_METADATA_KEY = Symbol('enumTypeName');
export const ENUM_SOURCE_PATH_METADATA_KEY = Symbol('enumSourcePath');
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
export function EnumTypeName(options) {
    return (target, propertyKey) => {
        if (typeof options === 'string') {
            Reflect.defineMetadata(ENUM_TYPE_NAME_METADATA_KEY, options, target, propertyKey);
        }
        else {
            Reflect.defineMetadata(ENUM_TYPE_NAME_METADATA_KEY, options.name, target, propertyKey);
            if (options.sourcePath) {
                Reflect.defineMetadata(ENUM_SOURCE_PATH_METADATA_KEY, options.sourcePath, target, propertyKey);
            }
        }
    };
}
//# sourceMappingURL=decorators.js.map