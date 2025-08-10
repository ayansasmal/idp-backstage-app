import { CatalogProcessor, CatalogProcessorEmit, processingResult } from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
// ...existing code...
// ...existing code...

export class OrganizationApiProcessor implements CatalogProcessor {
    // ...existing code...

    getProcessorName(): string {
        return 'OrganizationApiProcessor';
    }

    async readLocation(
        location: LocationSpec,
        _optional: boolean,
        emit: CatalogProcessorEmit,
    ): Promise<boolean> {
        if (location.type !== 'organization-api') {
            return false;
        }

        try {
            const apiUrl = location.target;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch organization data: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle the JSON server response format
            const organizations = data.organizations || data;

            if (!Array.isArray(organizations)) {
                throw new Error('Expected organizations data to be an array');
            }

            for (const entity of organizations) {
                if (this.isValidEntity(entity)) {
                    emit(processingResult.entity(location, entity));
                }
            }

            return true;
        } catch (error) {
            emit(processingResult.generalError(location, `Failed to read organization data: ${error}`));
            return false;
        }
    }

    private isValidEntity(entity: any): entity is Entity {
        return (
            entity &&
            typeof entity === 'object' &&
            entity.apiVersion &&
            entity.kind &&
            entity.metadata &&
            entity.metadata.name
        );
    }
}
